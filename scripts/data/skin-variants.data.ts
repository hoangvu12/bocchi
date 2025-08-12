import { SkinVariant } from '../types/champion.types'

export const SPECIAL_SKIN_VARIANTS: Record<
  string,
  Record<string, { type: string; items: SkinVariant[] }>
> = {
  Jinx: {
    'Arcane Fractured Jinx': {
      type: 'exalted',
      items: [
        {
          id: 'arcane_fractured_hero',
          name: 'Hero',
          displayName: 'Arcane Fractured Jinx — Hero',
          githubUrl:
            'https://github.com/darkseal-org/lol-skins/blob/main/skins/Jinx/Exalted/Arcane%20Fractured%20Jinx%20%E2%80%94%20Hero.zip',
          downloadUrl:
            'https://raw.githubusercontent.com/darkseal-org/lol-skins/main/skins/Jinx/Exalted/Arcane%20Fractured%20Jinx%20%E2%80%94%20Hero.zip'
        },
        {
          id: 'arcane_fractured_menace',
          name: 'Menace',
          displayName: 'Arcane Fractured Jinx — Menace',
          githubUrl:
            'https://github.com/darkseal-org/lol-skins/blob/main/skins/Jinx/Exalted/Arcane%20Fractured%20Jinx%20%E2%80%94%20Menace.zip',
          downloadUrl:
            'https://raw.githubusercontent.com/darkseal-org/lol-skins/main/skins/Jinx/Exalted/Arcane%20Fractured%20Jinx%20%E2%80%94%20Menace.zip'
        },
        {
          id: 'arcane_fractured_powder',
          name: 'Powder',
          displayName: 'Arcane Fractured Jinx — Powder',
          githubUrl:
            'https://github.com/darkseal-org/lol-skins/blob/main/skins/Jinx/Exalted/Arcane%20Fractured%20Jinx%20%E2%80%94%20Powder.zip',
          downloadUrl:
            'https://raw.githubusercontent.com/darkseal-org/lol-skins/main/skins/Jinx/Exalted/Arcane%20Fractured%20Jinx%20%E2%80%94%20Powder.zip'
        }
      ]
    }
  },
  Lux: {
    'Elementalist Lux': {
      type: 'form',
      items: [
        {
          id: 'elementalist_air',
          name: 'Air',
          displayName: 'Lux Elementalist Air',
          githubUrl:
            'https://github.com/darkseal-org/lol-skins/blob/main/skins/Lux/forms/Elementalist%20Lux/Lux%20Elementalist%20Air.zip',
          downloadUrl:
            'https://raw.githubusercontent.com/darkseal-org/lol-skins/main/skins/Lux/forms/Elementalist%20Lux/Lux%20Elementalist%20Air.zip'
        },
        {
          id: 'elementalist_dark',
          name: 'Dark',
          displayName: 'Lux Elementalist Dark',
          githubUrl:
            'https://github.com/darkseal-org/lol-skins/blob/main/skins/Lux/forms/Elementalist%20Lux/Lux%20Elementalist%20Dark.zip',
          downloadUrl:
            'https://raw.githubusercontent.com/darkseal-org/lol-skins/main/skins/Lux/forms/Elementalist%20Lux/Lux%20Elementalist%20Dark.zip'
        },
        {
          id: 'elementalist_fire',
          name: 'Fire',
          displayName: 'Lux Elementalist Fire',
          githubUrl:
            'https://github.com/darkseal-org/lol-skins/blob/main/skins/Lux/forms/Elementalist%20Lux/Lux%20Elementalist%20Fire.zip',
          downloadUrl:
            'https://raw.githubusercontent.com/darkseal-org/lol-skins/main/skins/Lux/forms/Elementalist%20Lux/Lux%20Elementalist%20Fire.zip'
        },
        {
          id: 'elementalist_ice',
          name: 'Ice',
          displayName: 'Lux Elementalist Ice',
          githubUrl:
            'https://github.com/darkseal-org/lol-skins/blob/main/skins/Lux/forms/Elementalist%20Lux/Lux%20Elementalist%20Ice.zip',
          downloadUrl:
            'https://raw.githubusercontent.com/darkseal-org/lol-skins/main/skins/Lux/forms/Elementalist%20Lux/Lux%20Elementalist%20Ice.zip'
        },
        {
          id: 'elementalist_magma',
          name: 'Magma',
          displayName: 'Lux Elementalist Magma',
          githubUrl:
            'https://github.com/darkseal-org/lol-skins/blob/main/skins/Lux/forms/Elementalist%20Lux/Lux%20Elementalist%20Magma.zip',
          downloadUrl:
            'https://raw.githubusercontent.com/darkseal-org/lol-skins/main/skins/Lux/forms/Elementalist%20Lux/Lux%20Elementalist%20Magma.zip'
        },
        {
          id: 'elementalist_mystic',
          name: 'Mystic',
          displayName: 'Lux Elementalist Mystic',
          githubUrl:
            'https://github.com/darkseal-org/lol-skins/blob/main/skins/Lux/forms/Elementalist%20Lux/Lux%20Elementalist%20Mystic.zip',
          downloadUrl:
            'https://raw.githubusercontent.com/darkseal-org/lol-skins/main/skins/Lux/forms/Elementalist%20Lux/Lux%20Elementalist%20Mystic.zip'
        },
        {
          id: 'elementalist_nature',
          name: 'Nature',
          displayName: 'Lux Elementalist Nature',
          githubUrl:
            'https://github.com/darkseal-org/lol-skins/blob/main/skins/Lux/forms/Elementalist%20Lux/Lux%20Elementalist%20Nature.zip',
          downloadUrl:
            'https://raw.githubusercontent.com/darkseal-org/lol-skins/main/skins/Lux/forms/Elementalist%20Lux/Lux%20Elementalist%20Nature.zip'
        },
        {
          id: 'elementalist_storm',
          name: 'Storm',
          displayName: 'Lux Elementalist Storm',
          githubUrl:
            'https://github.com/darkseal-org/lol-skins/blob/main/skins/Lux/forms/Elementalist%20Lux/Lux%20Elementalist%20Storm.zip',
          downloadUrl:
            'https://raw.githubusercontent.com/darkseal-org/lol-skins/main/skins/Lux/forms/Elementalist%20Lux/Lux%20Elementalist%20Storm.zip'
        },
        {
          id: 'elementalist_water',
          name: 'Water',
          displayName: 'Lux Elementalist Water',
          githubUrl:
            'https://github.com/darkseal-org/lol-skins/blob/main/skins/Lux/forms/Elementalist%20Lux/Lux%20Elementalist%20Water.zip',
          downloadUrl:
            'https://raw.githubusercontent.com/darkseal-org/lol-skins/main/skins/Lux/forms/Elementalist%20Lux/Lux%20Elementalist%20Water.zip'
        }
      ]
    }
  },
  MissFortune: {
    'Gun Goddess Miss Fortune': {
      type: 'form',
      items: [
        {
          id: 'gun_goddess_form2',
          name: 'Form 2',
          displayName: 'GunGoddess MF form 2',
          githubUrl:
            'https://github.com/darkseal-org/lol-skins/blob/main/skins/Miss%20Fortune/Gun%20Goddess%20Miss%20Fortune%20forms/GunGoddess%20MF%20form%202.zip',
          downloadUrl:
            'https://raw.githubusercontent.com/darkseal-org/lol-skins/main/skins/Miss%20Fortune/Gun%20Goddess%20Miss%20Fortune%20forms/GunGoddess%20MF%20form%202.zip',
          imageUrl:
            'https://raw.githubusercontent.com/darkseal-org/lol-skins/main/skins/Miss%20Fortune/Gun%20Goddess%20Miss%20Fortune%20forms/Model%20Image/form_2.png'
        },
        {
          id: 'gun_goddess_form3',
          name: 'Form 3',
          displayName: 'GunGoddess MF form 3',
          githubUrl:
            'https://github.com/darkseal-org/lol-skins/blob/main/skins/Miss%20Fortune/Gun%20Goddess%20Miss%20Fortune%20forms/GunGoddess%20MF%20form%203.zip',
          downloadUrl:
            'https://raw.githubusercontent.com/darkseal-org/lol-skins/main/skins/Miss%20Fortune/Gun%20Goddess%20Miss%20Fortune%20forms/GunGoddess%20MF%20form%203.zip',
          imageUrl:
            'https://raw.githubusercontent.com/darkseal-org/lol-skins/main/skins/Miss%20Fortune/Gun%20Goddess%20Miss%20Fortune%20forms/Model%20Image/form_3.png'
        },
        {
          id: 'gun_goddess_form4',
          name: 'Form 4',
          displayName: 'GunGoddess MF form 4',
          githubUrl:
            'https://github.com/darkseal-org/lol-skins/blob/main/skins/Miss%20Fortune/Gun%20Goddess%20Miss%20Fortune%20forms/GunGoddess%20MF%20form%204.zip',
          downloadUrl:
            'https://raw.githubusercontent.com/darkseal-org/lol-skins/main/skins/Miss%20Fortune/Gun%20Goddess%20Miss%20Fortune%20forms/GunGoddess%20MF%20form%204.zip',
          imageUrl:
            'https://raw.githubusercontent.com/darkseal-org/lol-skins/main/skins/Miss%20Fortune/Gun%20Goddess%20Miss%20Fortune%20forms/Model%20Image/form_4.png'
        }
      ]
    }
  },
  Sona: {
    'DJ Sona': {
      type: 'form',
      items: [
        {
          id: 'dj_sona_2nd_form',
          name: '2nd Form',
          displayName: 'DJ Sona 2nd form',
          githubUrl:
            'https://github.com/darkseal-org/lol-skins/blob/main/skins/Sona/DJ%20Sona%20form/DJ%20Sona%202nd%20form.zip',
          downloadUrl:
            'https://raw.githubusercontent.com/darkseal-org/lol-skins/main/skins/Sona/DJ%20Sona%20form/DJ%20Sona%202nd%20form.zip',
          imageUrl:
            'https://raw.githubusercontent.com/darkseal-org/lol-skins/main/skins/Sona/DJ%20Sona%20form/Preview%20Image/DJ%20Sona%202nd%20form.png'
        },
        {
          id: 'dj_sona_3rd_form',
          name: '3rd Form',
          displayName: 'DJ Sona 3rd form',
          githubUrl:
            'https://github.com/darkseal-org/lol-skins/blob/main/skins/Sona/DJ%20Sona%20form/DJ%20Sona%203nd%20form.zip',
          downloadUrl:
            'https://raw.githubusercontent.com/darkseal-org/lol-skins/main/skins/Sona/DJ%20Sona%20form/DJ%20Sona%203nd%20form.zip',
          imageUrl:
            'https://raw.githubusercontent.com/darkseal-org/lol-skins/main/skins/Sona/DJ%20Sona%20form/Preview%20Image/DJ%20Sona%203nd%20form.png'
        }
      ]
    }
  }
}
