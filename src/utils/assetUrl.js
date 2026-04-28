export const assetUrl = (path) => {
  if (!path || typeof path !== "string") return "";
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;
};
