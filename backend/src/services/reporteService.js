const registroVentaRepository = require('../repositories/registroVentaRepository');

async function obtenerDatosDashboard() {

    const [
        resumenGeneral,
        ventasPorDia,
        ventasPorFranjaHoraria,
        ventasPorCategoria,
        historialMermas
    ] = await Promise.all([
        registroVentaRepository.obtenerResumenGeneral(),
        registroVentaRepository.obtenerVentasPorDia(),
        registroVentaRepository.obtenerVentasPorFranjaHoraria(),
        registroVentaRepository.obtenerVentasPorCategoria(),
        registroVentaRepository.obtenerHistorialMermas()
    ]);

    return {
        resumenGeneral,
        ventasPorDia,
        ventasPorFranjaHoraria,
        ventasPorCategoria,
        historialMermas
    };
}

module.exports = {
  obtenerDatosDashboard
};