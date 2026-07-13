# Solar Rush

[English](README.md) | [简体中文](README.zh-CN.md)

一个运行在浏览器中的交互式太阳系观测与时间模拟器。项目以 React 和 Three.js 构建，将星历驱动的行星位置、卫星、轨道、时间推进、天体信息与响应式 3D 界面整合在同一个场景中。

[在线体验](https://rayshen.github.io/solar-rush/)

## 项目初心

Solar Rush 最初的目的，是让人能够从上帝视角观察太阳系——在尽可能真实地呈现天体、轨道与时间运动的同时，保留宇宙本身令人着迷的尺度感、秩序感与神秘感。

它不只是一个天体数据展示工具，也希望成为一扇可以自由凝视太阳系的窗口。

## 当前能力

- 展示太阳、八大行星及主要卫星，并提供可搜索的天体索引。
- 使用 Astronomy Engine 的 VSOP87/NOVAS 星历模型计算八大行星的日心位置，支持连续时间推进和多档模拟速度。
- 提供 `Orbit View`、`Artistic Spiral` 和 `Follow View` 三种观察模式。
- 支持旋转、缩放、平移、天体选择与选中目标跟随。
- 展示半径、轨道周期、转动周期、重力、逃逸速度等天体数据。
- 同步显示 UTC、北京时间和中国农历日期。
- 使用真实天体纹理、J2000 对齐的程序化银河、星表恒星、轨道与运动光迹增强空间层次。
- 提供移动端沉浸式悬浮标题栏、可折叠控制区、触控友好的天体导航与可滚动详情面板。

## 视觉稿

桌面端的设计目标是把专业天文软件的信息密度，与具有沉浸感的太空视觉体验结合起来：左侧负责天体导航，中间保留最大的 3D 观测区域，右侧呈现选中天体信息，顶部和底部承载时间控制。移动端则以无遮挡的 3D 场景为核心，只保留轻量悬浮标题栏，将视角切换、天体导航、详情与时间轴收纳到可滚动菜单中。

### Orbit View

以完整太阳系结构为核心，强调行星相对位置、轨道层级和整体空间关系，适合全局观察与天体导航。

![Solar Rush 轨道视图设计稿](visuals/orbit.png)

### Artistic Spiral

采用当前太阳系银心速度在 J2000 黄道坐标中的真实方向；运动光迹保留该方向关系，同时压缩距离与螺距，以兼顾辨识度和沉浸感。

![Solar Rush 运动视图设计稿](visuals/running.png)

### Follow View

聚焦选中的天体及其局部系统，降低无关轨道的视觉干扰，便于查看卫星关系、运动轨迹和天体细节。

![Solar Rush 聚焦视图设计稿](visuals/focus.png)

## 当前实现

下面的截图展示了当前开发版本的三种观察模式。

### Orbit View

![Solar Rush 当前轨道视图](docs/images/orbit-view.jpg)

### Artistic Spiral

![Solar Rush 当前艺术螺旋视图](docs/images/artistic-spiral-view.jpg)

### Follow View

![Solar Rush 当前跟随视图](docs/images/follow-view.jpg)

### 移动端视图

移动端让 3D 场景保持主导，将高密度控制项收进可展开、适合触控的菜单。

![Solar Rush 当前移动端视图](docs/images/mobile-view.jpg)

## 科学模型与比例

- 八大行星位置使用 [Astronomy Engine](https://github.com/cosinekitty/astronomy) 的日心状态向量，在 J2000 赤道坐标系计算后转换到场景的 J2000 黄道坐标系。艺术螺旋中的每条行星光迹都由该行星瞬时位置与速度的角动量矢量确定轨道面，从而保留真实轨道倾角与升交点方向。
- 主要卫星采用轻量的 J2000 平均轨道参数外推，属于视觉近似，不等同于 Horizons/SPICE 级卫星星历。
- 银河不是照片贴图，而是程序化生成；标准银道面与 Hipparcos 恒星从银河/ICRS 坐标经 J2000 赤道坐标转换到与行星一致的 J2000 黄道场景坐标，从而保留约 `60.19°` 的银道面—黄道面夹角。物理动力学中心采用 Sgr A* 的观测位置（黄经 `266.8517°`、黄纬 `−5.6077°`），不再把历史银河坐标原点等同于精确物理银心；核球宽度、恒星云和中央尘埃暗带仍属于视觉模型。
- 银河系俯视子视角采用 ESA/Gaia 的数据辅助艺术重建图；太阳标记按官方标注的 8.2 kpc 位置校准，其他结构标签只是从标注模型图映射的大致锚点，不代表测得的精确边界。该视角既不是实拍照片，也不是完整三维恒星密度图。
- 视觉模式分别压缩天体大小和轨道距离以保证可读性；物理模式采用统一比例：一个场景单位等于 5000 万公里。
- `Artistic Spiral` 采用当前太阳系银心速度模型 `(U, V, W) = (9.5, 250.7, 8.56) km/s`，转换后的 J2000 黄经约为 `342.2°`、黄纬约为 `61.0°`。方向有数据依据；光迹距离与螺距仍经过视觉压缩，不是完整银河轨道的比例模型。

## 技术栈

- React 19
- Three.js
- Astronomy Engine 2
- Vite 7
- GitHub Actions / GitHub Pages

## 本地运行

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
npm run preview
```

## 部署

项目通过 [GitHub Actions](.github/workflows/deploy-pages.yml) 自动部署。推送到 `master` 分支后，工作流会执行依赖安装、生产构建并发布 `dist` 目录到 GitHub Pages。

## 数据与素材说明

行星位置适用于交互式可视化，不应替代航天导航或专业观测规划。卫星轨道外推、视觉比例压缩、程序化银河、银河俯视重建图和运动光迹仍包含近似或艺术化表达。纹理素材的来源和授权信息见 [ATTRIBUTION.md](public/textures/ATTRIBUTION.md)。
