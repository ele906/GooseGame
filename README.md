backup site - https://ele906.github.io/GooseGameBackup/

# 🦆 Goose Migration Game - Advanced Ecological Simulation

A browser-based ecological simulation game featuring **stochastic modeling**, **normal distributions**, **individual genetic variation**, and **dynamic environmental systems**. Watch geese migrate, breed, and survive in realistic climate zones with day/night cycles and adaptive terrain!

**Built with Python/Flask backend, pure JavaScript/Canvas frontend, and advanced Monte Carlo simulation techniques.**

---

## 🌟 Key Features

### 🎲 **Advanced Stochastic Simulation**
- **Normal Distribution Sampling** (Box-Muller transform) for realistic variation
- **Individual Genetic Variation** - Each goose has unique survival rates
- **Multi-Parameter Probability** - Genetics × Climate × Energy interactions
- **Monte Carlo Methods** - Population dynamics with emergent complexity
- **Variable Growth Times** - N(3, 0.5) weeks for eggs, N(8, 1.5) for goslings
- **Dynamic Clutch Sizes** - N(4, 1.5) eggs per breeding (1-8 range)

### 🌍 **Geographic & Climate System**
- **Real Latitude/Longitude** tracking (45°N, 75°W starting position)
- **5 Climate Zones**: Arctic, Subarctic, Temperate, Subtropical, Tropical
- **Climate-Based Survival Rates** - Harsh climates reduce survival chances
- **Directional Migration** - Move North/South/East/West to change location
- **Dynamic Terrain Generation** - Vegetation and water vary by climate
- **Day/Night Cycle** - Full 24-hour cycle with visual atmosphere changes

### 🎮 **Interactive Gameplay**
- **Keyboard Controls** - Arrow keys/WASD to pan the camera
- **Mouse Controls** - Click geese to hide them in bushes
- **Real-Time Event Log** - See everything happening (breeding, deaths, storms)
- **10-Second Safe Period** - Learn controls before predators attack
- **Fullscreen Mode** - Optimized compact view
- **Density-Dependent Predation** - More geese = more predators

### 📊 **Visual Features**
- **Real Animal Images** - Geese, goslings, eggs, foxes, eagles, bushes
- **Day/Night Visuals** - Blue sky transitions to starry night
- **Color-Coded Events** - Green (positive), orange (warning), red (danger)
- **Time Display** - Shows game time with ☀️/🌙 icon and 24-hour clock
- **Climate-Based Terrain** - Arctic tundra vs tropical wetlands

---

## 🚀 Quick Start

### Requirements
- **Python 3.7+** (check with `python --version`)
- That's it! Flask is included in requirements.txt

### Installation

```bash
# 1. Navigate to project folder
cd GooseGameWeb

# 2. Install dependencies
pip install -r requirements.txt

# 3. Run the game!
python app.py

# 4. Open your browser to:
# http://localhost:5000
```

**Game starts automatically!** 🎉

---

## 🎯 How to Play

### Controls
- **⌨️ Arrow Keys / WASD** - Pan the camera around the map
- **🖱️ Click Geese** - Make individual geese hide in bushes
- **🔘 Mate Button** - Trigger breeding attempt
- **🌳 Hide All Button** - Send all geese to nearest bushes
- **🧭 Migration Buttons** - Move North/South/East/West
- **⛶ Fullscreen Button** - Toggle fullscreen mode
- **⏸️ Pause/Reset** - Control game flow

### Game Mechanics

**Lifecycle:**
1. **Eggs** 🥚 - Incubate for 2-4 weeks (variable per egg)
2. **Goslings** 🐥 - Grow for 5-11 weeks (variable per individual)
3. **Adults** 🦆 - Can breed and migrate

**Breeding:**
- Requires 1 male + 1 female adult with >50% energy
- 65-95% success chance (varies per attempt)
- Produces 1-8 eggs (usually 3-5) per successful breeding
- 5-minute cooldown between breeding attempts

---

## 🌡️ Climate System

### Climate Zones & Effects

| Climate | Latitude | Survival | Terrain |
|---------|----------|----------|---------|
| **Arctic** | >60°N | 60% | 1 pond, 1 bush (sparse) |
| **Subarctic** | 50-60°N | 80% | 2 ponds, 2 bushes |
| **Temperate** | 35-50°N | 100% ✨ | 2-3 ponds, 3-4 bushes |
| **Subtropical** | 20-35°N | 85% | 2 ponds, 3 bushes |
| **Tropical** | <20°N | 70% | 3-4 ponds, 4-5 bushes (lush) |

**Strategy:** Migrate to Temperate zones for optimal breeding!

---

## 🛠️ Technical Architecture

### Technology Stack

**Backend:**
- **Python 3** - Server runtime
- **Flask** - Web framework

**Frontend:**
- **HTML5 Canvas** - 2D graphics (60 FPS)
- **Vanilla JavaScript** - No frameworks (1300+ lines)
- **CSS3** - Modern styling

**Simulation:**
- **Monte Carlo Methods** - Stochastic modeling
- **Normal Distributions** - Box-Muller transform
- **Agent-Based Modeling** - Individual entities
- **Event-Driven Architecture** - Real-time logging

---

## 🎓 Skills Demonstrated

### Computer Science
✅ Object-Oriented Programming
✅ Game Loops (60 FPS)
✅ State Machines
✅ AI Pathfinding
✅ Event-Driven Architecture
✅ Canvas API Graphics

### Statistics & Simulation
✅ Monte Carlo Simulation
✅ Normal Distributions
✅ Stochastic Processes
✅ Population Dynamics
✅ Agent-Based Modeling
✅ Multi-Parameter Systems

### Web Development
✅ Flask Server
✅ Client-Server Architecture
✅ Responsive Design
✅ Asset Management
✅ Keyboard/Mouse Input

---

## 💡 Resume Talking Points

**This project demonstrates:**

✨ **Advanced JavaScript** - 1300+ lines of OOP code
✨ **Statistical Modeling** - Normal distributions, Monte Carlo
✨ **Game Development** - 60 FPS loop, AI, collisions
✨ **Full-Stack Skills** - Python/Flask + Canvas
✨ **Algorithm Design** - Pathfinding, state machines
✨ **Mathematical Modeling** - Multi-parameter probability

**Interview Answer:**
> "I built an ecological simulation using Monte Carlo methods and normal distributions. Each goose has individual genetic variation sampled from bell curves, and survival depends on genetics × climate × energy. The simulation creates emergent population dynamics including boom-bust cycles and natural selection. I used pure JavaScript with Canvas for 60 FPS rendering, and implemented day/night cycles, keyboard controls, and climate-based terrain generation."

---

## 🚀 Deployment

### Heroku
```bash
echo "web: python app.py" > Procfile
heroku create
git push heroku main
```

### Replit
1. Upload to [replit.com](https://replit.com)
2. Click "Run" - auto-detects Flask!

### GitHub Pages (Static)
Remove Flask, use static HTML hosting

---

## 📝 License

**MIT License** - Free to use and modify!

---

## 🙏 Acknowledgments

- Inspired by real goose migration patterns
- Climate zones based on Köppen classification
- Monte Carlo techniques from statistical literature

---

**Made with 🦆, 🎲, and ❤️**

*A simulation showcasing advanced stochastic modeling and ecological dynamics*
