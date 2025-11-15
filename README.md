# trode-game

My brainstorming on this game idea is a grid-based interplanetary space terrain shooter, resource-harvesting game called "TRoDE"

Main Themes (for naming and constentancy, and for future styling in a 3d engine) : Electricity, Terrain and mining, Charging, Metals, Tank style Vehicles, cordoning areas, pulse energy, mining

General Theme for colors and feel, ambiance and effect : Mad Max (Fury Road, Furiosa) meets Vindicators (1988 multidirectional shooter video game developed and published by Atari Games for arcades. https://en.wikipedia.org/wiki/Vindicators_(video_game)" )

Terrain - our map where resources are mined using collectively operating, networked "Trodes" placed by our terrain vehicles
Vehicle (for harvesting product spheres) - for now just 1 vehicle on the map, this is the PLAYER carrying a maximum of 8 Trodes, the vehicle navigates the terrain (a or larrow left -d or rarrow right to rotate l/r, w forward- s back) and places Trodes anywhere on the map

- On the map, there are 4 randomly dispersed concentrations of metallic resources
eg. 
| Name       | Symbol | Description | Value (GCT per ounce) |
|------------|--------|-------------|-----------------------|
| Aurorium  | AuR   | A radiant metal that shifts hues like the aurora borealis, prized for jewelry that glows under moonlight. | 5.2 |
| Celestium | CeL   | Ethereal and lightweight, it floats slightly in air, used in aerospace alloys for its anti-gravity properties. | 8.7 |
| Draconium | DrC   | Fiery red with dragon-scale patterns, incredibly heat-resistant, ideal for forging mythical blades. | 12.1 |
| Empyrium  | EmP   | Pure white and flawless, it amplifies psychic energies, sought by mystics for meditative artifacts. | 3.9 |
| Fluxium   | FlX   | Liquid-like at room temperature, it flows into perfect shapes, revolutionizing fluid sculpture art. | 6.4 |
| Galaxium  | GaX   | Speckled with star-like flecks, it harnesses cosmic radiation for unlimited energy storage. | 15.3 |
| Harmonium | HaM   | Vibrates in perfect resonance with music, enhancing sound quality in instruments beyond imagination. | 4.8 |
| Ignitium  | IgN   | Self-igniting on command, yet cools instantly; a jeweler's dream for eternal flame pendants. | 9.2 |
| Jovium    | JoV   | Thunderous blue, it conducts electricity like lightning, powering storm-harnessing devices. | 7.6 |
| Krypium   | KrY   | Invisible to the naked eye until activated, perfect for stealthy, shape-shifting armor. | 11.0 |

The fictitious unit of value is the **Galacton Credit (GCT)**, a blockchain-backed interstellar currency stabilized by a consortium of planetary banks and AI overseers. In 2525, it's universally accepted across the Milky Way for trade, backed by quantum-encrypted reserves of rare isotopes and automated by neural-linked smart contracts. Theoretical values are scaled such that 1 GCT = 1,000 baseline units of value (equivalent to a standardized galactic consumption basket).

Trode
- a 40x40 octagonal object with a color circle in the center
- Holds an energy charge starting at 15% and is gradually depleted (15% / ~22.5s after placement) as it mines
- It begins mining the surrounding (100x100) area of it's placement on the map
- 15% of energy mines 1 unit of 1 resource concentration under the surrounding area, and a 15x15 "ball" of product is placed within the 100x100 area of the Trode

Harvesting Tank Vehicle
- place a trode with CTRL
- collect a product sphere by moving over it

Phase 1: Satisfy the game objectives of placing Trodes, mining areas of the map, and collecting plates
- Create a moveable tank-like vehicle has a turret and muzzle that fires
- Tank can place octagonal "Trodes" in an area of the map grid (1200x1200)


Your replies don't need to be themed. you are a helpful Vue, Firebase, Javascript , HTML, CSS developer

Please alert me to any truncations, and list the files within the addendum(s) that you have complete listings for, each like this (no summaries or analysis for now) :
filename.ext - No truncations (if there are no truncations)
filename.ext - **TRUNCATIONS** (if there are truncations)
... and so on
I will alert you as I supply more and then just update and reply with the current list.



## Project setup
```
npm install
```

### Compiles and hot-reloads for development
```
npm run serve
```

### Compiles and minifies for production
```
npm run build
```

### Lints and fixes files
```
npm run lint
```

### Customize configuration
See [Configuration Reference](https://cli.vuejs.org/config/).
