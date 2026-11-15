/* =========================================================
   作品数据文件
   ---------------------------------------------------------
   替换方法：把每条的 seed 换成你自己的图片文件名即可，
   例如图片放在 assets/works/ 下，就把
     seed: 'cn-newyear-palace-gold'
   改成
     seed: 'assets/works/kv-newyear.jpg'
   （必须带 assets/ 前缀；写成 works/xxx.jpg 会被当成 picsum 随机种子）

   批量归位：图片命名成 w01-随便写.jpg 丢进 assets/works/，
   然后跑 python tools/ingest.py，seed 和 ratio 会自动写好。

   ratio 只能用这六档，保持瀑布流错落：
   '4/5'  '3/4.5'  '1/1'  '4/3'  '2.8/4.2'  '16/10'

   当前图片是 picsum 占位图，仅用于看版式效果。
   ========================================================= */

window.WORKS = [
  {
    id: 'w01',
    title: '春节版本主视觉',
    project: '极品芝麻官',
    tool: 'Midjourney',
    type: '游戏KV',
    ratio: '4/5',
    year: '2026',
    seed: 'cn-newyear-palace-gold',
    featured: true,
    prompt: 'royal palace gate at night, red and gold color scheme, hanging lanterns with soft bokeh, festive crowd silhouette, cinematic lighting, ultra detailed, 8k, vertical composition',
    note: '先定中轴对称的构图骨架，再让 AI 只负责建筑与灯笼的光氛围。人物与所有中文文案统一在 PS 里合成，避免 AI 写坏字形。'
  },
  {
    id: 'w02',
    title: 'S12 赛季更新视觉',
    project: '球球英雄',
    tool: 'ComfyUI',
    type: '游戏KV',
    ratio: '16/10',
    year: '2026',
    seed: 'bubble-season-keyart',
    featured: true,
    prompt: 'glossy bubble characters in dynamic motion, playful arena background, bright rim light, high saturation but controlled, game key art, wide composition',
    note: '用 ComfyUI 固定角色 LoRA 保证前后赛季形象一致，ControlNet 约束版式留白，横版右侧留出赛季信息位。'
  },
  {
    id: 'w03',
    title: '新英雄登场',
    project: '潮英雄',
    tool: 'Midjourney',
    type: '游戏KV',
    ratio: '3/4.5',
    year: '2025',
    seed: 'mecha-hero-launch',
    featured: true,
    prompt: 'mecha warrior standing pose, neon cyan and magenta rim light, dark hangar background, volumetric fog, heroic low angle, character key art',
    note: '先出 6 版剪影，选定后再做细节放大。机甲接缝用 i2i 逐步强化，强度控制在 0.55 以内，避免改掉原始造型。'
  },
  {
    id: 'w04',
    title: '上线主视觉',
    project: '永夜降临',
    tool: 'Stable Diffusion',
    type: '游戏KV',
    ratio: '2.8/4.2',
    year: '2025',
    seed: 'eternal-night-launch',
    featured: false,
    prompt: 'dark fantasy castle under eclipse, ash particles, cold blue moonlight with a warm ember accent, atmospheric depth, epic scale, vertical poster',
    note: '冷蓝主调只留一处暖光做视觉锚点，观众第一眼落在主角身上而不是背景。'
  },
  {
    id: 'w05',
    title: '武侠主题视觉',
    project: '我是高手',
    tool: 'Midjourney',
    type: '游戏KV',
    ratio: '4/3',
    year: '2025',
    seed: 'wuxia-ink-mountain',
    featured: false,
    prompt: 'ink wash mountain range, swordswoman silhouette on a cliff, mist layers, minimal color palette of ink black and cinnabar red, traditional chinese aesthetic',
    note: '水墨效果用负空间做留白，红色只出现在剑穗一处。留白区专门为中文标题预留，后期排版不遮主体。'
  },
  {
    id: 'w06',
    title: '公测主视觉',
    project: '我要练神功',
    tool: 'ComfyUI',
    type: '游戏KV',
    ratio: '4/5',
    year: '2024',
    seed: 'kungfu-open-beta',
    featured: false,
    prompt: 'martial arts training ground, golden hour dust, scroll and practice dummy props, warm earthy tones, cinematic depth of field',
    note: '场景细节靠 ComfyUI 分层出图再合，前景道具单独生成后贴入，方便按版式需要挪动位置。'
  },
  {
    id: 'w07',
    title: '古风伙伴立绘',
    project: '极品芝麻官',
    tool: 'Stable Diffusion',
    type: '角色立绘',
    ratio: '3/4.5',
    year: '2026',
    seed: 'court-lady-portrait',
    featured: true,
    prompt: 'elegant ancient chinese lady in embroidered hanfu, standing full body, soft studio light, clean background, character illustration, fine fabric detail',
    note: '立绘要求全身完整，出图后用局部重绘修手部与发饰。服装纹样单独生成后叠加，保证花纹不糊。'
  },
  {
    id: 'w08',
    title: '机甲角色设定',
    project: '潮英雄',
    tool: 'Midjourney',
    type: '角色立绘',
    ratio: '4/5',
    year: '2025',
    seed: 'mecha-character-sheet',
    featured: false,
    prompt: 'mecha character turntable sheet, front three quarter and back views, grey studio background, technical illustration, panel lines, consistent proportions',
    note: '三视图一次出齐，靠同一 seed 加权重锁定。设定稿交付给建模前先统一比例尺。'
  },
  {
    id: 'w09',
    title: '暗系角色立绘',
    project: '永夜降临',
    tool: 'ComfyUI',
    type: '角色立绘',
    ratio: '2.8/4.2',
    year: '2025',
    seed: 'dark-elf-warrior',
    featured: false,
    prompt: 'dark elf warrior with twin blades, black leather armor with silver trim, dramatic side lighting, smoky background, full body character art',
    note: '深色服装容易丢细节，出图后在 PS 里用曲线单独提暗部层次，保证缩小到 200px 仍能看清轮廓。'
  },
  {
    id: 'w10',
    title: '门派掌门立绘',
    project: '我是高手',
    tool: 'Photoshop',
    type: '角色立绘',
    ratio: '1/1',
    year: '2025',
    seed: 'sect-master-portrait',
    featured: false,
    prompt: 'old martial arts master portrait, long white beard, brocade robe, half body, warm candle light, painterly rendering',
    note: '这一张以手绘精修为主，AI 只用来快速试了三版胡须与衣纹走向，最终按选定方向重画。'
  },
  {
    id: 'w11',
    title: '盲盒周边主图',
    project: '球球英雄',
    tool: 'Midjourney',
    type: '电商主图',
    ratio: '1/1',
    year: '2026',
    seed: 'blindbox-product-shot',
    featured: true,
    prompt: 'blind box toy set on a clean acrylic stand, soft studio softbox lighting, pastel gradient backdrop, product photography, sharp focus, 1:1',
    note: '产品图必须与实物一致，所以只用 AI 出背景与光位，产品本体来自实拍抠图。这是商业图的底线。'
  },
  {
    id: 'w12',
    title: '降噪耳机主图',
    project: '数码家电',
    tool: 'ChatGPT',
    type: '电商主图',
    ratio: '4/5',
    year: '2025',
    seed: 'headphone-studio-white',
    featured: false,
    prompt: 'white over ear headphones floating on a soft grey gradient, single studio light, subtle reflection, premium tech product shot, clean minimal',
    note: '先用语言模型把卖点整理成一句画面描述，再转去生图。参数类文案一律后贴，绝不让 AI 写进图里。'
  },
  {
    id: 'w13',
    title: '香薰礼盒主图',
    project: '家居香氛',
    tool: 'Midjourney',
    type: '电商主图',
    ratio: '1/1',
    year: '2025',
    seed: 'aroma-gift-box',
    featured: false,
    prompt: 'aroma gift set with dried flowers, warm linen texture, morning window light, shallow depth of field, lifestyle product shot, cozy neutral palette',
    note: '氛围型类目可以放开场景，但礼盒外包装的印刷图案要保留实物，用蒙版固定后再融合。'
  },
  {
    id: 'w14',
    title: '银饰项链主图',
    project: '国潮银饰',
    tool: 'ComfyUI',
    type: '电商主图',
    ratio: '2.8/4.2',
    year: '2024',
    seed: 'silver-necklace-macro',
    featured: false,
    prompt: 'silver pendant necklace macro shot, black velvet surface, controlled specular highlight, jewelry photography, extreme detail on metal engraving',
    note: '金属高光靠灯光不靠笔刷。垫图重绘强度压在 0.60 以内，超过就会改掉吊坠的款式，珠宝和 3C 都适用这条。'
  },
  {
    id: 'w15',
    title: '国潮耳饰主图',
    project: '国潮耳饰',
    tool: 'Stable Diffusion',
    type: '电商主图',
    ratio: '1/1',
    year: '2024',
    seed: 'guochao-earring-flatlay',
    featured: false,
    prompt: 'chinese style earrings flat lay on rice paper, ink brush stroke background, top down view, soft even light, oriental aesthetic',
    note: '主图不放夸大词汇。批发场景还要显式标明材质，仿珍珠就写仿珍珠，这一条不能省。'
  },
  {
    id: 'w16',
    title: '手办详情页',
    project: '极品芝麻官',
    tool: 'Photoshop',
    type: '详情页',
    ratio: '2.8/4.2',
    year: '2026',
    seed: 'figure-detail-page',
    featured: false,
    prompt: 'collectible figure showcase page, multiple angles, dark stage background with rim light, premium collectible presentation',
    note: '长图按屏序推进：卖点、细节、场景、参数、售后。AI 负责场景与光效，产品多角度实拍不替换。'
  },
  {
    id: 'w17',
    title: '精华液详情页',
    project: '美妆护肤',
    tool: 'Midjourney',
    type: '详情页',
    ratio: '3/4.5',
    year: '2025',
    seed: 'serum-detail-page',
    featured: false,
    prompt: 'serum bottle on a wet stone surface, water droplets, cool toned spa atmosphere, soft gradient light, premium skincare visual',
    note: '美妆重质感，水和玻璃的折射用 AI 效率最高。功效表述必须能举证，做不到就把文案改成成分与使用感描述。'
  },
  {
    id: 'w18',
    title: '机械键盘详情页',
    project: '数码外设',
    tool: 'ComfyUI',
    type: '详情页',
    ratio: '4/3',
    year: '2025',
    seed: 'keyboard-detail-page',
    featured: false,
    prompt: 'mechanical keyboard exploded view on dark background, keycaps floating in layers, orange accent light, technical product visualization',
    note: '爆炸图用分层生成再叠加，每一层单独出图，后期调整间距就能控制信息的阅读节奏。'
  },
  {
    id: 'w19',
    title: 'AI 生图入门封面',
    project: '小红书',
    tool: 'ChatGPT',
    type: '小红书封面',
    ratio: '3/4.5',
    year: '2026',
    seed: 'xhs-cover-ai-basics',
    featured: true,
    prompt: 'bold typographic cover, high contrast dark background, single accent color block, clean grid layout, editorial poster style',
    note: '封面三秒法则：主体占画面六成，标题字压在最上层，字必须是后贴的矢量文本，不是生成的字形。'
  },
  {
    id: 'w20',
    title: 'ComfyUI 工作流封面',
    project: '小红书',
    tool: 'ComfyUI',
    type: '小红书封面',
    ratio: '4/5',
    year: '2026',
    seed: 'xhs-cover-workflow',
    featured: false,
    prompt: 'abstract node graph visual, glowing connections on dark canvas, cyan and violet lines, tech editorial illustration',
    note: '知识类封面用抽象图加明确标题，比堆砌界面截图点击率高。图只负责气质，信息靠排版。'
  },
  {
    id: 'w21',
    title: '设计师转型记封面',
    project: '小红书',
    tool: 'Photoshop',
    type: '小红书封面',
    ratio: '1/1',
    year: '2025',
    seed: 'xhs-cover-career',
    featured: false,
    prompt: 'personal storytelling cover, warm tone desk scene, notebook and tablet, soft window light, calm editorial photography',
    note: '个人叙事类用真实场景图更可信，AI 只做色调统一和瑕疵修补，不生成人物正脸。'
  },
  {
    id: 'w22',
    title: '周年庆主视觉',
    project: '极品芝麻官',
    tool: 'Midjourney',
    type: '海报',
    ratio: '2.8/4.2',
    year: '2025',
    seed: 'anniversary-poster',
    featured: false,
    prompt: 'grand celebration hall, gold confetti falling, ornate columns, warm festive lighting, symmetrical composition, poster layout with empty top area',
    note: '构图阶段就用提示词把标题区留空，后面对齐信息层级时不用再挖图。'
  },
  {
    id: 'w23',
    title: '大促活动海报',
    project: '电商大促',
    tool: 'Photoshop',
    type: '海报',
    ratio: '4/5',
    year: '2024',
    seed: 'double11-poster',
    featured: false,
    prompt: 'sale campaign poster, dynamic diagonal composition, product hero in center, bold color blocking, retail energy',
    note: '大促图信息密度高，AI 图只做背景与气氛，价格、券、门槛全部在 PS 里排，避免生成错误数字。'
  },
  {
    id: 'w24',
    title: '活动弹窗界面',
    project: '球球英雄',
    tool: 'Stable Diffusion',
    type: 'UI',
    ratio: '16/10',
    year: '2025',
    seed: 'popup-ui-panel',
    featured: false,
    prompt: 'game event popup design, fantasy border frame, jewel buttons, ornate panel, empty content area for text, ui asset',
    note: '界面类只让 AI 出边框与装饰件，按钮、文字、点击区全部在 UI 工具里重做，保证可切图可交互。'
  }
];
