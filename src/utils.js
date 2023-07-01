export const tryParse = (data) => {
  try {
    return JSON.parse(data);
  } catch (_) {
    return data;
  }
};
