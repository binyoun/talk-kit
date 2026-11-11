export interface Format {
  id: string;
  platform: string;
  label: string;
  w: number;
  h: number;
}

export const FORMATS: Format[] = [
  { id: 'ig-square', platform: 'Instagram', label: 'Square', w: 1080, h: 1080 },
  { id: 'ig-portrait', platform: 'Instagram', label: 'Portrait', w: 1080, h: 1350 },
  { id: 'ig-story', platform: 'Instagram', label: 'Story', w: 1080, h: 1920 },
  { id: 'li-post', platform: 'LinkedIn', label: 'Post', w: 1200, h: 627 },
  { id: 'li-square', platform: 'LinkedIn', label: 'Square', w: 1080, h: 1080 },
  { id: 'fb-post', platform: 'Facebook', label: 'Post', w: 1200, h: 630 },
  { id: 'x-post', platform: 'X / Threads', label: 'Post', w: 1600, h: 900 },
];
