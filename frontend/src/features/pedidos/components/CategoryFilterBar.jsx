import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { getCategoryDetails } from '../utils/categoryDetails';

export function CategoryFilterBar({
  searchTerm,
  setSearchTerm,
  categories,
  selectedCategoryId,
  setSelectedCategoryId,
}) {
  return (
    <div className="p-4 sm:p-5 bg-white rounded-2xl shadow-xs border border-gray-100 mb-4 shrink-0 z-10">
      <div className="relative mb-4">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
        <Input
          type="text"
          placeholder="Buscar producto..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full h-11 pl-12 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus-visible:ring-2 focus-visible:ring-secondary focus-visible:border-secondary text-base transition-all"
        />
      </div>

      <div className="flex gap-2 items-center flex-wrap overflow-x-auto py-1 -my-1 custom-scrollbar">
        <button
          type="button"
          onClick={() => setSelectedCategoryId('Todos')}
          className={`px-5 py-2 rounded-full whitespace-nowrap font-medium transition-all flex-shrink-0 cursor-pointer border ${
            selectedCategoryId === 'Todos'
              ? 'bg-primary text-primary-foreground border-primary shadow-md'
              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
          }`}
        >
          Todos
        </button>

        {categories.map((cat) => {
          const categoryName = cat.nombre || cat.name || '';
          const categoryId = String(cat.id);
          const details = getCategoryDetails(categoryName);
          const emoji = cat.icono || cat.icon || details.emoji;
          const { activeBg, activeBorder } = details;
          const isSelected = String(selectedCategoryId) === categoryId;

          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategoryId(categoryId)}
              title={categoryName}
              className={`p-2 w-13 h-13 rounded-2xl transition-all flex items-center justify-center flex-shrink-0 border-2 cursor-pointer ${
                isSelected
                  ? `${activeBg} ${activeBorder} shadow-lg scale-110`
                  : 'bg-white border-gray-100 hover:border-gray-300 hover:bg-gray-50 shadow-xs'
              }`}
            >
              <span
                className="text-2xl leading-none select-none"
                style={{ filter: isSelected ? 'none' : 'grayscale(20%)' }}
              >
                {emoji}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default CategoryFilterBar;
