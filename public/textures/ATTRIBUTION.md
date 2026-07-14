# Planetary texture attribution

## Solar System Scope / Qt 3D

The Sun, Mercury, Venus, Moon, Mars, Jupiter, Saturn, Uranus, Neptune, and
Saturn ring textures in `bodies/` come from the Solar System Scope Texture
Library as redistributed by the Qt 3D planets example.

- Source: https://sources.debian.org/src/qt3d-opensource-src/5.15.15%2Bdfsg-3/examples/qt3d/planets-qml/images/solarsystemscope/
- Project: https://www.solarsystemscope.com/textures
- License: Creative Commons Attribution 4.0
- Copyright: Solar System Scope, 2010-2017

## NASA/JPL/Caltech/USGS

The Phobos, Deimos, Io, Europa, Ganymede, Callisto, Titan, Rhea, Iapetus,
Dione, Titania, Oberon, and Triton maps in `bodies/` come from the JPL Solar
System Simulator texture-map database. They are mosaics or representative maps
derived from Viking, Voyager, Galileo, and other planetary observations.

- Source: https://maps.jpl.nasa.gov/tmaps/
- Credits: NASA/JPL/Caltech/USGS and the individual map creators listed there

The Earth day, normal, specular, cloud, and night-light maps in `earth/` are
the existing Three.js planetary example assets, based on global Earth imagery.

- Source: https://threejs.org/examples/textures/planets/

The higher-resolution Europa color mosaic combines Galileo and Voyager data and
was processed by Bjorn Jonsson.

- Source: https://www.planetary.org/space-images/color-global-map-of-europa
- Image data: NASA/JPL/PDS

## ESA / Giotto

The `bodies/halley.jpg` preview is a composite image of comet 1P/Halley's
nucleus assembled from observations made by ESA's Giotto spacecraft in 1986.

- Source: https://www.esa.int/ESA_Multimedia/Images/2002/01/A_composite_image_of_the_nucleus_of_comet_P_Halley
- Credits: ESA/MPAE

## ESA / Gaia / DPAC

The face-on Milky Way reconstruction in `galaxy/` is a data-informed artist's
impression based on results from ESA's Gaia mission. It is not a direct Gaia
stellar-density map or a photograph taken from outside the Galaxy.

- Source: https://www.esa.int/ESA_Multimedia/Images/2023/12/Top-down_view_of_the_Milky_Way
- Credits: ESA/Gaia/DPAC, Stefan Payne-Wardenaar
- License: CC BY-SA 3.0 IGO

## NASA Scientific Visualization Studio

The 8K celestial-sphere texture in `galaxy/sky/` is derived from
the Milky Way background layer of NASA SVS Deep Star Maps 2020. The source is
an ICRF/J2000 plate carrée map designed for spherical mapping and was built
from Hipparcos-2, Tycho-2, and Gaia DR2 catalogue data. The web assets are
tone-mapped from NASA's linear OpenEXR files and GPU-compressed as KTX2.

- Source: https://svs.gsfc.nasa.gov/4851/
- Visualization: Ernie Wright, NASA Scientific Visualization Studio
- Asset: `milkyway_2020_8k.exr`

The spiral-arm, bulge, and bar thumbnails in `galaxy/features/` are crops of
the same ESA/Gaia face-on reconstruction. They are model images, not external
photographs of individual spiral arms.

The Sagittarius A* thumbnail is the Event Horizon Telescope Collaboration's
1.3 mm observation reconstruction released by ESO.

- Source: https://www.eso.org/public/images/eso2208-eht-mwa/
- Credit: EHT Collaboration
- Type: Observation at 1.3 mm wavelength

The nuclear star cluster thumbnail is a Hubble WFC3/IR mosaic assembled from
observations taken between 2010 and 2014.

- Source: https://science.nasa.gov/asset/hubble/milky-way-nuclear-star-cluster/
- Credits: NASA, ESA, and the Hubble Heritage Team (STScI/AURA); T. Do,
  A. Ghez, V. Bajaj and collaborators
