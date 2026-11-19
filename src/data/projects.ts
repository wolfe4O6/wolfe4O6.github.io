// Projects shown on /projects and, when featured, on the home page.
// To add one: copy a block, set the name, the GitHub repo slug, and the description.
// The link is always https://github.com/wolfe4O6/<repo>
// Set featured: true to pin it on the home page. Set it to false to keep it on /projects only.

export interface Project {
  name: string;
  repo: string;
  description: string;
  featured?: boolean;
}

export const projects: Project[] = [
  {
    name: 'Detour',
    repo: 'Detour',
    description: 'Real adventure only begins when you take a Detour.',
    featured: true,
  },
  {
    name: 'DRIVE-READY',
    repo: 'DRIVE-READY',
    description: 'A simple and elegant way to log your supervised driving hours.',
    featured: true,
  },
  {
    name: 'D-D-Organizer',
    repo: 'D-D-Organizer',
    description: 'Organize your D&D with AI.',
  },
  {
    name: 'Glide',
    repo: 'Glide---Paper-Airplane-Exploraton-',
    description:
      'Experience what it feels like to be a paper airplane, floating in the wind - or space!',
    featured: true,
  },
  {
    name: 'Chickens',
    repo: 'Chickens-',
    description: 'A brand emailer',
  },
  {
    name: 'wardrobe-bot',
    repo: 'wardrobe-bot',
    description: 'No description on GitHub yet.',
  },
  {
    name: 'autonomous-business',
    repo: 'autonomous-business',
    description: 'Desktop-controlled autonomous business experiments... Planning stage.',
  },
];

export function projectUrl(repo: string): string {
  return `https://github.com/wolfe4O6/${encodeURIComponent(repo)}`;
}

export function featuredProjects(): Project[] {
  return projects.filter((project) => project.featured);
}
