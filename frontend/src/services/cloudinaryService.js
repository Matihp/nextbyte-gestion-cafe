/**
 * Servicio para gestión y subida de imágenes a Cloudinary (Client-Side Direct Upload).
 */

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export const isCloudinaryConfigured = () => {
  return Boolean(CLOUD_NAME && UPLOAD_PRESET);
};

export const getCloudinaryConfig = () => ({
  cloudName: CLOUD_NAME || '',
  uploadPreset: UPLOAD_PRESET || '',
  isReady: isCloudinaryConfigured(),
});

/**
 * Sube una imagen directamente desde el cliente a Cloudinary.
 * @param {File} file - Archivo de imagen seleccionado por el usuario.
 * @param {Object} [options] - Opciones adicionales (ej. carpeta opcional).
 * @returns {Promise<{ url: string, publicId: string, format: string, width: number, height: number }>}
 */
export const uploadImageToCloudinary = async (file, options = {}) => {
  if (!file) {
    throw new Error('Debe seleccionar un archivo para subir.');
  }

  if (!file.type.startsWith('image/')) {
    throw new Error('El archivo seleccionado no es una imagen válida.');
  }

  const MAX_SIZE_MB = options.maxSizeMB || 5;
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    throw new Error(`La imagen supera el tamaño máximo permitido de ${MAX_SIZE_MB} MB.`);
  }

  if (!isCloudinaryConfigured()) {
    throw new Error(
      'Faltan configurar las variables de entorno en frontend/.env:\n' +
      'VITE_CLOUDINARY_CLOUD_NAME y VITE_CLOUDINARY_UPLOAD_PRESET.\n' +
      'Configúralas con tu Cloud Name y tu Upload Preset sin firmar (Unsigned) de Cloudinary.'
    );
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);

  if (options.folder) {
    formData.append('folder', options.folder);
  }

  try {
    const endpoint = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMsg = data?.error?.message || `Error en la subida a Cloudinary (${response.status})`;
      throw new Error(errorMsg);
    }

    return {
      url: data.secure_url || data.url,
      publicId: data.public_id,
      format: data.format,
      width: data.width,
      height: data.height,
    };
  } catch (error) {
    console.error('Error al subir imagen a Cloudinary:', error);
    throw error;
  }
};

export const getOptimizedAvatarUrl = (url, size = 200) => {
  if (!url || typeof url !== 'string') return '';
  if (!url.includes('res.cloudinary.com')) return url;

  if (url.includes('/c_fill,g_face')) return url;

  const uploadIndex = url.indexOf('/upload/');
  if (uploadIndex === -1) return url;

  const transformation = `/upload/c_fill,g_face,w_${size},h_${size},q_auto,f_auto/`;
  return url.replace('/upload/', transformation);
};

