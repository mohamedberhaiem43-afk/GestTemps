export const formatCellDate = (value: unknown): string => {
  if (!value) return '-';
  
  try {
    const date = typeof value === 'string' 
      ? new Date(value) 
      : value instanceof Date 
        ? value 
        : null;
    
    return date?.toLocaleDateString() ?? value.toString();
  } catch {
    return value.toString();
  }
};