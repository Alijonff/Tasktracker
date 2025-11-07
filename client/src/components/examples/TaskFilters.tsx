import TaskFilters from '../TaskFilters';

export default function TaskFiltersExample() {
  return (
    <div className="p-4">
      <TaskFilters onFilterChange={(filters) => console.log('Filters changed:', filters)} />
    </div>
  );
}
