const reporteService = require('../services/reporteService');

const obtenerEstadisticas = async (req, res) => {
    try {
        const datos = await reporteService.obtenerDatosDashboard();
        res.json({ success: true, data: datos });
    } catch (error) {
        console.error('Error al obtener estadísticas:', error);
        res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
};

module.exports = {
    obtenerEstadisticas
};