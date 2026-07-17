export interface StyleOption {
  id: string
  label: string
}

export interface StyleGroup {
  label: string
  options: StyleOption[]
}

const style = (id: string, label: string): StyleOption => ({ id, label })

export const DEFAULT_STYLE = 'rd_plus__default'

export const STYLE_GROUPS: StyleGroup[] = [
  {
    label: 'RD Plus',
    options: [
      style('rd_plus__default', 'Default'),
      style('rd_plus__retro', 'Retro'),
      style('rd_plus__classic', 'Classic'),
      style('rd_plus__cartoon', 'Cartoon'),
      style('rd_plus__watercolor', 'Watercolor'),
      style('rd_plus__textured', 'Textured'),
      style('rd_plus__environment', 'Environment'),
      style('rd_plus__isometric', 'Isometric'),
      style('rd_plus__topdown_map', 'Top-down map'),
      style('rd_plus__topdown_asset', 'Top-down asset'),
      style('rd_plus__item_sheet', 'Item sheet'),
      style('rd_plus__character_turnaround', 'Character turnaround'),
      style('rd_plus__ui_element', 'UI element'),
      style('rd_plus__skill_icon', 'Skill icon'),
      style('rd_plus__low_res', 'Low res'),
      style('rd_plus__mc_item', 'MC item'),
      style('rd_plus__mc_texture', 'MC texture'),
    ],
  },
  {
    label: 'RD Fast',
    options: [
      style('rd_fast__default', 'Default'),
      style('rd_fast__simple', 'Simple'),
      style('rd_fast__detailed', 'Detailed'),
      style('rd_fast__retro', 'Retro'),
      style('rd_fast__game_asset', 'Game asset'),
      style('rd_fast__portrait', 'Portrait'),
      style('rd_fast__texture', 'Texture'),
      style('rd_fast__ui', 'UI'),
      style('rd_fast__item_sheet', 'Item sheet'),
      style('rd_fast__character_turnaround', 'Character turnaround'),
      style('rd_fast__1_bit', '1-bit'),
      style('rd_fast__low_res', 'Low res'),
    ],
  },
  {
    label: 'RD Pro',
    options: [
      style('rd_pro__default', 'Default'),
      style('rd_pro__painterly', 'Painterly'),
      style('rd_pro__fantasy', 'Fantasy'),
      style('rd_pro__horror', 'Horror'),
      style('rd_pro__scifi', 'Sci-fi'),
      style('rd_pro__simple', 'Simple'),
      style('rd_pro__isometric', 'Isometric'),
      style('rd_pro__topdown', 'Top-down'),
      style('rd_pro__platformer', 'Platformer'),
      style('rd_pro__dungeon_map', 'Dungeon map'),
      style('rd_pro__ui_panel', 'UI panel'),
      style('rd_pro__inventory_items', 'Inventory items'),
    ],
  },
]
