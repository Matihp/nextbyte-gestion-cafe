import { useState, useEffect } from 'react';

const ERROR_IMG_SRC =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODgiIGhlaWdodD0iODgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgc3Ryb2tlPSIjMDAwIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBvcGFjaXR5PSIuMyIgZmlsbD0ibm9uZSIgc3Ryb2tlLXdpZHRoPSIzLjciPjxyZWN0IHg9IjE2IiB5PSIxNiIgd2lkdGg9IjU2IiBoZWlnaHQ9IjU2IiByeD0iNiIvPjxwYXRoIGQ9Im0xNiA1OCAxNi0xOCAzMiAzMiIvPjxjaXJjbGUgY3g9IjUzIiBjeT0iMzUiIHI9IjciLz48L3N2Zz4KCg==';

export function ImageWithFallback({ src, alt, className = '', style, fallbackSrc, ...rest }) {
  const [didError, setDidError] = useState(false);

  // Reiniciar estado de error si el prop src cambia
  useEffect(() => {
    setDidError(false);
  }, [src]);

  const cleanSrc = typeof src === 'string' ? src.trim() : null;

  if (!cleanSrc || didError) {
    if (fallbackSrc) {
      return (
        <img
          src={fallbackSrc}
          alt={alt || 'Producto'}
          className={className}
          style={style}
          {...rest}
        />
      );
    }
    return (
      <div
        className={`inline-block bg-gray-100 text-center align-middle ${className}`}
        style={style}
      >
        <div className="flex items-center justify-center w-full h-full">
          <img
            src={ERROR_IMG_SRC}
            alt={alt || 'Imagen no disponible'}
            className="w-10 h-10 opacity-35 object-contain"
          />
        </div>
      </div>
    );
  }

  return (
    <img
      src={cleanSrc}
      alt={alt}
      className={className}
      style={style}
      onError={() => setDidError(true)}
      {...rest}
    />
  );
}

export default ImageWithFallback;


