// This module is imported only by next dev. These server-only imports let
// Turbopack refresh the preview when a public data file changes.
import resources from '../data/generated/resources.json' with { type:'json' };
import routes from '../data/generated/routes.json' with { type:'json' };
import prices from '../data/generated/prices.json' with { type:'json' };
import blocks from '../data/generated/blocks.json' with { type:'json' };
import assets from '../data/generated/assets.json' with { type:'json' };
import community from '../data/generated/community.json' with { type:'json' };
import shell from '../data/shell.json' with { type:'json' };
export const devData = { resources, routes, prices, blocks, assets, community, shell };
