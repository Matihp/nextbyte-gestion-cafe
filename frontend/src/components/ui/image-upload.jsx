import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  Camera, 
  Trash2, 
  Check, 
  Loader2, 
  Image as ImageIcon,
  Info
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { 
  uploadImageToCloudinary, 
  isCloudinaryConfigured, 
  getOptimizedAvatarUrl 
} from '@/services/cloudinaryService';

/**
 * Componente universal de subida de imágenes a Cloudinary.
 * 
 * @param {Object} props
 * @param {string} [props.value] - URL actual de la imagen.
 * @param {Function} props.onChange - Callback al cambiar la imagen (retorna la nueva URL o vacío).
 * @param {Function} [props.onSave] - Callback asíncrono opcional si se desea auto-guardar en la BD al subir: async (url) => Promise<void>.
 * @param {string} [props.folder='general'] - Carpeta de destino en Cloudinary ('perfiles', 'productos', 'empleados', etc.).
 * @param {'circle' | 'square' | 'rounded'} [props.shape='circle'] - Forma visual del preview.
 * @param {'sm' | 'md' | 'lg' | 'xl'} [props.size='lg'] - Tamaño del preview.
 * @param {string} [props.label] - Título o etiqueta sobre el campo.
 * @param {string} [props.placeholderInitials] - Iniciales a mostrar en forma 'circle' si no hay imagen (ej. 'MA').
 * @param {string} [props.buttonText] - Texto personalizado para el botón principal de subida.
 * @param {string} [props.changeButtonText='Cambiar Foto'] - Texto del botón cuando ya hay una imagen.
 * @param {string} [props.successMessage='Imagen guardada con éxito'] - Mensaje temporal al completar la subida.
 * @param {string} [props.helperText] - Texto de ayuda inferior.
 * @param {number} [props.maxSizeMB=5] - Tamaño máximo en MB.
 * @param {string} [props.className] - Clases adicionales de estilo para el contenedor.
 */
export function ImageUpload({
  value = '',
  onChange,
  onSave,
  folder = 'general',
  shape = 'circle',
  size = 'lg',
  label,
  placeholderInitials = '',
  buttonText,
  changeButtonText = 'Cambiar Foto',
  successMessage = 'Imagen guardada con éxito',
  helperText = 'JPG, PNG o WEBP (máx. 5 MB)',
  maxSizeMB = 5,
  className
}) {
  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState(null); // { message, type: 'success' | 'info' }
  const fileInputRef = useRef(null);
  const feedbackTimeoutRef = useRef(null);
  const isReady = isCloudinaryConfigured();

  // Limpiar timeout de feedback al desmontar
  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, []);

  const triggerTemporaryFeedback = (message, type = 'success', duration = 3500) => {
    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
    }
    setFeedback({ message, type });
    feedbackTimeoutRef.current = setTimeout(() => {
      setFeedback(null);
    }, duration);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isReady) {
      toast.error(
        'Configura VITE_CLOUDINARY_CLOUD_NAME y VITE_CLOUDINARY_UPLOAD_PRESET en frontend/.env para subir imágenes.'
      );
      return;
    }

    setUploading(true);
    const toastId = toast.loading('Subiendo imagen a Cloudinary...');

    try {
      // 1. Subir a Cloudinary en la carpeta correspondiente
      const result = await uploadImageToCloudinary(file, { folder, maxSizeMB });
      
      // Si es avatar circular, optimizar rostro
      const finalUrl = shape === 'circle' 
        ? getOptimizedAvatarUrl(result.url, 300) 
        : result.url;

      // 2. Si hay hook de auto-guardado en base de datos, ejecutarlo
      if (onSave) {
        await onSave(finalUrl);
      }

      // 3. Notificar al componente padre
      onChange?.(finalUrl);

      toast.success('¡Imagen subida correctamente!', { id: toastId });
      triggerTemporaryFeedback(successMessage, 'success', 3500);
    } catch (err) {
      console.error('Error al subir imagen a Cloudinary:', err);
      toast.error(err.message || 'Error al procesar la imagen', { id: toastId });
    } finally {
      setUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleRemove = async () => {
    try {
      setUploading(true);
      if (onSave) {
        await onSave(null);
      }
      onChange?.('');
      toast.success('Imagen eliminada');
      triggerTemporaryFeedback('Imagen eliminada', 'info', 2500);
    } catch (err) {
      console.error('Error al quitar imagen:', err);
      toast.error('No se pudo quitar la imagen');
    } finally {
      setUploading(false);
    }
  };

  // Clases por tamaño
  const sizeClasses = {
    sm: shape === 'circle' ? 'w-12 h-12' : 'w-16 h-16',
    md: shape === 'circle' ? 'w-16 h-16' : 'w-24 h-24',
    lg: shape === 'circle' ? 'w-20 h-20' : 'w-28 h-28',
    xl: shape === 'circle' ? 'w-28 h-28' : 'w-36 h-36',
  }[size] || 'w-20 h-20';

  const shapeClass = shape === 'circle' ? 'rounded-full' : shape === 'rounded' ? 'rounded-xl' : 'rounded-lg';
  const defaultButtonText = buttonText || (shape === 'circle' ? 'Subir Foto' : 'Subir Imagen');

  return (
    <div className={cn('space-y-2', className)}>
      {label && <Label className="block text-sm font-medium text-gray-700">{label}</Label>}

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 bg-stone-50 rounded-xl border border-gray-200">
        {/* Contenedor del Preview */}
        <div className="relative group shrink-0">
          <div
            className={cn(
              sizeClasses,
              shapeClass,
              'bg-[#F3E5DC] flex items-center justify-center text-[#9F4F2F] font-bold overflow-hidden border-2 border-[#A67C52]/30 shadow-inner'
            )}
          >
            {uploading ? (
              <div className="w-full h-full flex flex-col items-center justify-center bg-stone-900/65 text-white p-1 text-center">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-[9px] mt-1 font-medium leading-tight">Subiendo...</span>
              </div>
            ) : value ? (
              <img
                src={value}
                alt="Vista previa"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : shape === 'circle' && placeholderInitials ? (
              <span className="text-xl uppercase select-none">{placeholderInitials}</span>
            ) : (
              <ImageIcon className="w-8 h-8 text-[#A67C52]/60" />
            )}
          </div>

          {/* Botón flotante para cambiar foto rápida en avatares circulares */}
          {shape === 'circle' && (
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              title="Seleccionar foto"
              className="absolute bottom-0 right-0 p-1.5 bg-[#9F4F2F] text-white rounded-full shadow hover:bg-[#4B2B1D] transition-colors cursor-pointer disabled:opacity-50"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Input de archivo oculto */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
        />

        {/* Acciones y feedback */}
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white rounded-lg border-0 cursor-pointer disabled:opacity-60 shadow-sm"
              style={{ backgroundColor: '#9F4F2F' }}
            >
              {uploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Subiendo a Cloudinary...
                </>
              ) : value ? (
                <>
                  <Camera className="w-3.5 h-3.5" />
                  {changeButtonText}
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  {defaultButtonText}
                </>
              )}
            </Button>

            {value && (
              <Button
                type="button"
                variant="outline"
                onClick={handleRemove}
                disabled={uploading}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 rounded-lg cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Quitar
              </Button>
            )}
          </div>

          {/* Feedback temporal o ayuda permanente */}
          <div className="text-xs transition-all duration-300 min-h-[22px] flex items-center">
            {feedback ? (
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium animate-in fade-in zoom-in-95 duration-200',
                  feedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-stone-100 text-stone-700 border border-stone-200'
                )}
              >
                {feedback.type === 'success' && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                {feedback.message}
              </span>
            ) : (
              <span className="text-gray-500 text-[11px]">{helperText}</span>
            )}
          </div>
        </div>
      </div>

      {!isReady && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2">
          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Configuración de Cloudinary requerida:</p>
            <p className="mt-0.5">
              Agrega en tu archivo <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-[11px]">frontend/.env</code> las variables <code className="font-mono">VITE_CLOUDINARY_CLOUD_NAME</code> y <code className="font-mono">VITE_CLOUDINARY_UPLOAD_PRESET</code>.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default ImageUpload;

