const {
  MODOS_OPERATIVOS,
  ESTADOS_INTERNET,
  ESTADOS_CLOUD,
  CODIGOS_ERROR,
  ROLES_APP
} = require('../constants/contingencia');
const { isNetworkError, isQuotaError, isAuthError } = require('../config/databaseErrors');
const { parseContingencyConfig } = require('../config/contingencyConfig');

class ConnectivityService {
  constructor(options = {}) {
    this.env = options.env || process.env;
    this.config = options.config || parseContingencyConfig(this.env, options.databaseMode);
    this.databaseMode = options.databaseMode || this.config.effectiveDbMode;

    this.probeFetch = options.probeFetch || globalThis.fetch;
    this.clock = options.clock || {
      now: () => Date.now(),
      setTimeout: (fn, ms) => setTimeout(fn, ms),
      clearTimeout: (id) => clearTimeout(id)
    };

    this.mode = this.databaseMode === 'local' ? MODOS_OPERATIVOS.ONLINE : MODOS_OPERATIVOS.STARTING;
    this.internetStatus = this.databaseMode === 'local' ? ESTADOS_INTERNET.UNKNOWN : ESTADOS_INTERNET.UNKNOWN;
    this.cloudStatus = this.databaseMode === 'local' ? ESTADOS_CLOUD.UNKNOWN : ESTADOS_CLOUD.UNKNOWN;
    this.localReady = false;
    this.localReadyReason = 'BOOTSTRAP_PENDIENTE';
    this.pendingCount = 0;
    this.uncertainCount = 0;
    this.lastSuccessfulSyncAt = null;
    this.lastCloudSeq = 0;
    this.lastCloudSuccessAt = null;
    this.reason = null;
    this.writerId = this.config.writerId;

    this.activeTimer = null;
    this.probeInProgress = false;
    this.abortController = null;
    this.listeners = new Set();
    this.isDestroyed = false;

    if (this.databaseMode === 'test') {
      this.mode = MODOS_OPERATIVOS.ONLINE;
      this.cloudStatus = ESTADOS_CLOUD.REACHABLE;
      this.internetStatus = ESTADOS_INTERNET.REACHABLE;
    } else if (this.databaseMode === 'local') {
      this.mode = MODOS_OPERATIVOS.ONLINE;
      this.localReady = true;
      this.localReadyReason = null;
    }
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  _notify() {
    for (const fn of this.listeners) {
      try {
        fn(this.getState());
      } catch {
      }
    }
  }
  reportCloudSuccess() {
    this.lastCloudSuccessAt = this.clock.now();
    this.cloudStatus = ESTADOS_CLOUD.REACHABLE;
    this.internetStatus = ESTADOS_INTERNET.REACHABLE;

    if (this.mode === MODOS_OPERATIVOS.STARTING ||
        this.mode === MODOS_OPERATIVOS.CHECKING_CONNECTIVITY ||
        this.mode === MODOS_OPERATIVOS.CLOUD_UNAVAILABLE) {
      if (this.pendingCount > 0 && this.config.isContingencyEnabled) {
        this.mode = MODOS_OPERATIVOS.RECOVERING;
        this.reason = 'REPLAY_PENDIENTE';
      } else {
        this.mode = MODOS_OPERATIVOS.ONLINE;
        this.reason = null;
      }
      this._notify();
    }
  }

  async reportCloudFailure(error) {
    if (isQuotaError(error)) {
      this.cloudStatus = ESTADOS_CLOUD.QUOTA;
      this.reason = CODIGOS_ERROR.TURSO_QUOTA;
      this.mode = MODOS_OPERATIVOS.CLOUD_UNAVAILABLE;
      this._notify();
      return;
    }

    if (isAuthError(error)) {
      this.cloudStatus = ESTADOS_CLOUD.AUTH_ERROR;
      this.reason = 'TURSO_AUTH_ERROR';
      this.mode = MODOS_OPERATIVOS.CLOUD_UNAVAILABLE;
      this._notify();
      return;
    }

    if (isNetworkError(error)) {
      this.cloudStatus = ESTADOS_CLOUD.UNAVAILABLE;
      if (this.mode !== MODOS_OPERATIVOS.OFFLINE_ACTIVE && this.mode !== MODOS_OPERATIVOS.CHECKING_CONNECTIVITY) {
        this.mode = MODOS_OPERATIVOS.CHECKING_CONNECTIVITY;
        this.reason = 'VERIFICANDO_CONECTIVIDAD';
        this._notify();
        await this.verifyConnectivity();
      }
      return;
    }
  }

  async _probeUrl(url, timeoutMs) {
    const controller = new AbortController();
    const timeoutId = this.clock.setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await this.probeFetch(url, {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store'
      });
      this.clock.clearTimeout(timeoutId);

      if (url.includes('generate_204')) {
        if (response.status === 204) return true;
        return false;
      }

      if (url.includes('cloudflare.com')) {
        if (response.status === 200) {
          const text = await response.text();
          if (text.includes('fl=') || text.includes('h=')) return true;
        }
        return false;
      }

      return response.ok;
    } catch {
      this.clock.clearTimeout(timeoutId);
      return false;
    }
  }

  async _runProbeRound() {
    const urls = this.config.probeUrls;
    const timeout = this.config.probeTimeoutMs;
    const promises = urls.map((url) => this._probeUrl(url, timeout));
    const results = await Promise.all(promises);
    return results.some(Boolean);
  }

 
  async verifyConnectivity() {
    if (this.probeInProgress || this.isDestroyed) return;
    this.probeInProgress = true;

    try {
      const round1Success = await this._runProbeRound();
      if (round1Success) {
        this.internetStatus = ESTADOS_INTERNET.REACHABLE;
        this.mode = MODOS_OPERATIVOS.CLOUD_UNAVAILABLE;
        this.reason = CODIGOS_ERROR.CLOUD_UNAVAILABLE;
        this._notify();
        return;
      }

      await new Promise((resolve) => this.clock.setTimeout(resolve, this.config.probeRetryDelayMs));

      const round2Success = await this._runProbeRound();
      if (round2Success) {
        this.internetStatus = ESTADOS_INTERNET.REACHABLE;
        this.mode = MODOS_OPERATIVOS.CLOUD_UNAVAILABLE;
        this.reason = CODIGOS_ERROR.CLOUD_UNAVAILABLE;
        this._notify();
        return;
      }

      this.internetStatus = ESTADOS_INTERNET.UNREACHABLE;

      if (!this.config.isContingencyEnabled) {
        this.mode = MODOS_OPERATIVOS.CLOUD_UNAVAILABLE;
        this.reason = CODIGOS_ERROR.CLOUD_UNAVAILABLE;
        this._notify();
        return;
      }

      if (this.localReady && this.uncertainCount === 0) {
        this.mode = MODOS_OPERATIVOS.OFFLINE_ACTIVE;
        this.reason = 'INTERNET_UNREACHABLE';
      } else {
        this.mode = MODOS_OPERATIVOS.BLOCKED_UNSAFE;
        this.reason = this.uncertainCount > 0
          ? CODIGOS_ERROR.OPERATION_UNCERTAIN
          : (this.localReadyReason || CODIGOS_ERROR.OFFLINE_NOT_READY);
      }
      this._notify();
    } catch {
      this.internetStatus = ESTADOS_INTERNET.UNKNOWN;
      this.mode = MODOS_OPERATIVOS.BLOCKED_UNSAFE;
      this.reason = CODIGOS_ERROR.CONNECTIVITY_UNKNOWN;
      this._notify();
    } finally {
      this.probeInProgress = false;
    }
  }

  setLocalMirrorState({ ready, reason = null, pendingCount = 0, uncertainCount = 0, lastCloudSeq = 0 }) {
    this.localReady = Boolean(ready);
    this.localReadyReason = reason;
    this.pendingCount = Number(pendingCount);
    this.uncertainCount = Number(uncertainCount);
    if (lastCloudSeq) this.lastCloudSeq = Number(lastCloudSeq);

    if (this.mode === MODOS_OPERATIVOS.OFFLINE_ACTIVE && !this.localReady) {
      this.mode = MODOS_OPERATIVOS.BLOCKED_UNSAFE;
      this.reason = this.localReadyReason || CODIGOS_ERROR.OFFLINE_NOT_READY;
    }
    this._notify();
  }

  startIdleMonitor() {
    if (this.activeTimer || this.isDestroyed || this.databaseMode === 'test') return;

    const scheduleNext = () => {
      const interval = this.mode === MODOS_OPERATIVOS.OFFLINE_ACTIVE ? 8000 : this.config.idleProbeIntervalMs;
      this.activeTimer = this.clock.setTimeout(async () => {
        if (this.isDestroyed) return;

        if (this.mode === MODOS_OPERATIVOS.OFFLINE_ACTIVE || this.mode === MODOS_OPERATIVOS.CLOUD_UNAVAILABLE) {
          try {
            const { verificarConexionTurso, sincronizar } = require('../jobs/syncJob');
            const tursoOk = await verificarConexionTurso(3000);
            if (tursoOk) {
              if (this.mode === MODOS_OPERATIVOS.OFFLINE_ACTIVE) {
                await sincronizar();
              } else {
                this.mode = MODOS_OPERATIVOS.ONLINE;
                this.reason = null;
                this.reportCloudSuccess();
              }
            }
          } catch {}
        } else {
          const now = this.clock.now();
          const timeSinceLastSuccess = this.lastCloudSuccessAt ? (now - this.lastCloudSuccessAt) : Infinity;

          if (timeSinceLastSuccess > this.config.idleProbeIntervalMs) {
            if (this.mode === MODOS_OPERATIVOS.ONLINE || this.mode === MODOS_OPERATIVOS.CLOUD_UNAVAILABLE) {
              await this.verifyConnectivity();
            }
          }
        }
        scheduleNext();
      }, interval);
    };

    scheduleNext();
  }

  stopIdleMonitor() {
    if (this.activeTimer) {
      this.clock.clearTimeout(this.activeTimer);
      this.activeTimer = null;
    }
  }

  destroy() {
    this.isDestroyed = true;
    this.stopIdleMonitor();
    this.listeners.clear();
  }

  getState(user = null) {
    const isOnline = this.mode === MODOS_OPERATIVOS.ONLINE;
    const canOperateOffline = this.mode === MODOS_OPERATIVOS.OFFLINE_ACTIVE &&
      this.localReady &&
      Boolean(
        user && (
          user.es_contingencia ||
          user.rol_id === '877890f1-ffc8-488b-a5c4-b1caff520383' 
        )
      );

    let canOperate = false;
    if (isOnline) {
      canOperate = true;
    } else if (this.mode === MODOS_OPERATIVOS.OFFLINE_ACTIVE) {
      canOperate = canOperateOffline;
    }

    return {
      mode: this.mode,
      internetStatus: this.internetStatus,
      cloudStatus: this.cloudStatus,
      localReady: this.localReady,
      localReadyReason: this.localReadyReason,
      pendingCount: this.pendingCount,
      uncertainCount: this.uncertainCount,
      lastSuccessfulSyncAt: this.lastSuccessfulSyncAt,
      lastCloudSeq: this.lastCloudSeq,
      writerId: this.writerId,
      reason: this.reason,
      canOperate,
      canOperateOffline,
      isOnline,
      databaseMode: this.databaseMode,
      syncEnabled: Boolean(this.config.isContingencyEnabled)
    };
  }
}

let defaultInstance = null;

function getConnectivityService(options = {}) {
  if (!defaultInstance || options.forceNew) {
    defaultInstance = new ConnectivityService(options);
  }
  return defaultInstance;
}

module.exports = {
  ConnectivityService,
  getConnectivityService
};

