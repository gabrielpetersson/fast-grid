export const isEmptyFast = (obj: any) => {
  for (const _ in obj) {
    return false;
  }
  return true;
};
