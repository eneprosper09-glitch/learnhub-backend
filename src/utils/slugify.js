import slugifyLib from 'slugify';

export const toSlug = (text) => {
  return slugifyLib(String(text), { lower: true, strict: true, trim: true });
};