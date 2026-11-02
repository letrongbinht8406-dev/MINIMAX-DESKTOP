import type { PromptPreset, PromptPresetCategory } from '../types'

const preset = (category: PromptPresetCategory, id: string, label: string, description: string, insertion: string, keywords = ''): PromptPreset => ({ id: `${category}.${id}`, category, label, description, insertion, keywords: `${label} ${description} ${keywords}`.toLowerCase().split(/\s+/) })

export const promptPresets: PromptPreset[] = [
  preset('continuity', 'single-take', '一镜到底', '保持整个片段在一个连续镜头中。', 'Continuity: one uninterrupted take from beginning to end. No cuts, dissolves, time jumps, or changes of location.', 'h3 one shot no cuts continuous'),
  preset('continuity', 'screen-direction', '保持画面方向', '保持镜头中运动方向一致。', 'Continuity: maintain the established left-to-right or right-to-left travel direction. Keep the camera on the same side of the action axis.', '180 degree axis geography'),
  preset('continuity', 'identity', '身份锁定', '在运动过程中保持每个指定人物的一致性。', 'Continuity: preserve each assigned character’s face, proportions, hair, and distinguishing features through turns and partial occlusion. Keep different people distinct.', '参考面部一致性'),
  preset('continuity', 'wardrobe', '服装连续性', '保持指定服装一致。', 'Continuity: retain the assigned garments, colors, materials, layers, and accessories throughout the shot. Fabric may move naturally without changing the outfit.', 'costume clothing'),
  preset('continuity', 'prop-contact', '道具接触', '保持手持物体固定在正确的手上。', 'Continuity: maintain the same prop shape, size, and grip. Fingers remain in plausible contact with its surface until a deliberate release.', 'hands object grip'),
  preset('continuity', 'background', '稳定背景', '保持建筑和固定地标一致。', 'Continuity: retain the layout, doors, windows, furniture, and fixed background landmarks. Reveal them through plausible camera parallax without morphing or duplication.', 'room geometry environment'),
  preset('continuity', 'exposure', '稳定曝光', '避免帧间亮度和色彩偏移。', 'Continuity: maintain a consistent exposure, white balance, and lighting direction. Allow only motivated changes caused by visible lights or subject movement.', 'flicker color temporal'),
  preset('continuity', 'edit-handles', '干净剪辑余量', '为剪辑保留稳定的开头和结尾。', 'Timing: briefly establish a stable opening pose, perform the requested action, and leave a short settled hold at the end for a clean edit.', 'trim editing start end'),
  preset('continuity', 'last-frame', '到达最后一帧', 'For First + last mode with both frames attached.', 'Continuity: move naturally from the supplied first frame toward the supplied last frame. Resolve the action into its closing composition without a dissolve or sudden pose change.', 'first last transition fl2v'),
  preset('continuity', 'no-overlays', '干净画面', '避免生成图形出现在画面中。', 'Presentation: no captions, subtitles, watermarks, interface graphics, or added text overlays.', 'clean output typography'),
  preset('movement', 'listening', '倾听反应', '另一人说话时的安静反应。', 'Performance: listen attentively with a restrained eye movement and one subtle change of expression. Keep the mouth relaxed and avoid speaking or exaggerated nodding.', 'dialogue reaction silent'),
  preset('movement', 'eye-line', '保持视线', '保持注意力在既定目标上。', 'Performance: maintain a consistent eyeline toward the established person or object. Use natural blinks without wandering gaze or looking into the lens unless requested.', 'gaze eye contact'),
  preset('movement', 'weight-transfer', '落地重心转移', '让姿态变化在视觉上清晰可辨。', 'Action: shift weight gradually through the hips and supporting foot before stepping. Keep planted feet grounded and the body balanced.', 'feet walking sliding'),
  preset('movement', 'reach-grasp', '伸手抓取', '一次清晰的手与物体的交互。', 'Action: reach toward the target object, open the hand before contact, close the fingers around its surface, then lift smoothly while maintaining the grip.', 'hand prop contact'),
  preset('audio', 'foley', '同步拟音', '将物理音效与可见的接触点对齐。', 'Sound: place footsteps, cloth movement, and object contact precisely at the visible actions. Keep each sound grounded in the room perspective.', 'sync footsteps contact'),
  preset('audio', 'dialogue-space', '对白优先混音', '当镜头启用对白时使用。', 'Sound: keep the requested speech clear and at a natural level. Place ambience underneath it, with no competing foreground voices or added score.', 'voice intelligibility mix'),
  preset('audio', 'offscreen', '画外音效提示', '暗示附近的活动，而不添加可见的主体。', 'Sound: a subtle offscreen cue comes from a consistent direction within the established environment. Do not introduce a new visible person or object to explain it.', 'spatial sound environment'),
  preset('audio', 'room-perspective', '一致的房间声学', '保持距离感和混响的一致性。', 'Sound: match reverberation and high-frequency detail to the visible room and source distance. Preserve the same acoustic space throughout the shot.', 'reverb ambience interior'),
  preset('shot', 'safe-framing', '交付安全构图', '为后续裁剪和重新构图留出空间。', 'Framing: keep the main face, hands, and essential action away from the frame edges, with intentional headroom and enough space for modest delivery crops.', 'vertical social safe margins'),
  preset('shot', 'two-person-blocking', '双人走位', '让两个人物及其关系清晰可辨。', 'Blocking: give each person a distinct position and consistent eyeline. Preserve clear silhouettes and avoid crossing or merging bodies during the exchange.', 'two shot dialogue staging'),
  preset('camera', 'static', 'Static', '固定构图，无镜头运动。', 'Camera: locked-off static camera on a stable tripod, maintaining identical framing throughout.'),
  preset('camera', 'slow-push-in', '缓慢推近', '向主体缓慢靠近。', 'Camera: a slow, smooth cinematic push-in toward the subject, maintaining stable framing and natural perspective.', 'dolly approach dramatic'),
  preset('camera', 'slow-pull-back', '缓慢拉远', '逐渐展现更多场景。', 'Camera: a slow, smooth pull-back that gradually reveals the surrounding environment while preserving a stable axis.'),
  preset('camera', 'dolly-in', '轨道推近', '物理向前镜头运动。', 'Camera: a controlled dolly-in on the subject with natural perspective shift and steady cinematic motion.'),
  preset('camera', 'dolly-out', '拉镜头', '镜头物理向后移动。', 'Camera: a controlled dolly-out from the subject, revealing context with stable, natural perspective.'),
  ...['左跟拍','右跟拍','侧面跟拍'].map((label, index) => preset('camera', `tracking-${index}`, label, '平滑的横向跟拍运动。', `Camera: ${label.toLowerCase()} in a smooth stabilized move, matching the subject's pace and preserving screen direction.`)),
  ...['左环绕','右环绕','180° Orbit','360° Orbit'].map((label, index) => preset('camera', `orbit-${index}`, label, '围绕主体的受控环绕运动。', `Camera: a smooth ${label.toLowerCase()} around the subject at constant distance, with stable anatomy and background parallax.`)),
  ...['摇臂上升','摇臂下降','升降上升','升降下降','上摇','下摇','左摇','右摇'].map((label, index) => preset('camera', `move-${index}`, label, '精确的方向性镜头运动。', `Camera: a slow, controlled ${label.toLowerCase()} with stable framing and a deliberate cinematic endpoint.`)),
  preset('camera', 'handheld-subtle', '手持（轻微）', '克制的人工操作运动。', 'Camera: subtle handheld movement with gentle natural drift, no harsh shake, and consistently readable framing.'),
  preset('camera', 'handheld-documentary', '手持（纪录片）', '响应式的观察运动。', 'Camera: grounded documentary handheld operation, responsively following the action with controlled realistic shake.'),
  ...['稳定器跟拍','肩扛跟拍','俯冲下降','低角度上升','环绕主体','移焦','甩镜头','固定机位'].map((label, index) => preset('camera', `special-${index}`, label, '专业级镜头调度。', `Camera: ${label.toLowerCase()} executed smoothly with clear subject priority and coherent screen direction.`)),
  ...[['extreme-wide','大远景','环境主导画面。'],['wide','Wide','完整环境与主体调度。'],['full-body','全身','从头到脚的主体构图。'],['cowboy','Cowboy','大腿中部构图，表现肢体语言。'],['medium','Medium','腰部以上对话式构图。'],['medium-close','中近景','胸部以上情感构图。'],['close-up','特写','面部主导的亲密构图。'],['extreme-close','大特写','聚焦精确的面部或物体细节。'],['ots','Over-the-Shoulder','前景肩部确立视线。'],['pov','POV','主观视角构图。'],['two-shot','双人镜头','两个主体共享清晰的构图。'],['insert','插入镜头','隔离一个有意义的物体或动作。']].map(([id,label,description]) => preset('shot', id, label, description, `Shot: ${label.toLowerCase()} composition; ${description.toLowerCase()} Maintain intentional headroom and clean visual hierarchy.`)),
  ...[['eye','Eye Level'],['low','Low Angle'],['high','High Angle'],['overhead','Overhead'],['ground','地面视角'],['dutch','荷兰角'],['profile','Profile'],['three-quarter','四分之三视角'],['rear','后方跟随']].map(([id,label]) => preset('angle', id, label, '定义视角与主体的关系。', `Camera angle: ${label.toLowerCase()}, preserving natural anatomy, readable spatial relationships, and intentional composition.`)),
  ...[['18','18mm','开阔超广角视角，强烈空间纵深感'],['24','24mm','广角环境视角，充满活力的纵深感'],['28','28mm','自然广角视角，环境清晰'],['35','35mm','电影感环境视角，中等景深'],['50','50mm','自然透视，浅而真实的景深'],['65','65mm','柔和压缩，主体分离精致'],['85','85mm','人像压缩，柔和背景分离'],['100','100mm Macro','微距细节，极浅精确对焦'],['135','135mm','强长焦压缩，背景孤立'],['anamorphic','Anamorphic','电影感水平视野，椭圆形焦外光斑，克制的镜头特性']].map(([id,label,description]) => preset('lens', id, label, description, `Lens: ${label}, ${description}. Keep focus transitions physically plausible.`)),
  ...[['window','柔和窗光'],['sunrise','Sunrise'],['golden','黄金时刻'],['overcast','Overcast'],['studio','柔和棚光'],['side','戏剧性侧光'],['practical','室内实用光'],['office','荧光灯办公室'],['moon','Moonlight'],['neon','Neon'],['candle','Candlelight'],['high','High Key'],['low','Low Key'],['silhouette','Silhouette']].map(([id,label]) => preset('lighting', id, label, '电影级布光设置。', `Lighting: ${label.toLowerCase()} with motivated sources, stable exposure, realistic skin response, and coherent shadows.`)),
  ...[['room','Room Tone'],['outdoor','户外环境音'],['city','城市氛围'],['office','办公室环境音'],['forest','森林环境音'],['vehicle','车内环境'],['crowd','人群低语'],['rain','Rain'],['wind','Wind'],['silence','静音 / 无音乐'],['cinematic','电影级环境音']].map(([id,label]) => preset('audio', id, label, '同步环境音效。', `Sound: ${label.toLowerCase()}, spatially coherent and synchronized to visible action; ${id === 'silence' ? '无音乐且无额外配乐。' : '无多余音乐。'}`)),
  preset('style', 'photoreal', '电影级写实', '自然材质与克制的调色。', 'Visual treatment: cinematic photorealism, realistic skin and materials, restrained filmic contrast, and natural color separation.'),
  preset('style', 'documentary', '纪录片写实', '观察式且自然不完美。', 'Visual treatment: grounded documentary realism with available-light texture, credible imperfections, and restrained grading.'),
  preset('style', 'commercial', '精致商业风', '干净的高端广告质感。', 'Visual treatment: polished premium commercial photography, precise surfaces, controlled highlights, and elegant color grading.'),
  preset('movement', 'subtle', '微妙表演', '小幅且符合物理规律的动作。', 'Action: restrained natural performance with subtle breathing, eye movement, and physically coherent body motion.'),
  preset('movement', 'confident', '果断运动', '有目的的走位与姿态。', 'Action: confident, purposeful movement with clear intention, controlled posture, and natural weight transfer.'),
  preset('movement', 'still', '保持静止', '最小化主体运动。', 'Action: the subject holds the pose with only natural breathing and tiny eye movement; no unintended gestures or position drift.'),
  preset('movement', 'single-beat', '单一清晰动作', '保持短片可读且可执行。', 'Action: one clear, physically achievable action with a visible beginning, middle, and settled end state. Do not introduce a second event.', 'h3 minimax reliable short clip'),
  preset('movement', 'settle', '结尾稳定', '为最终帧稳定留出时间。', 'Timing: complete the action before the final second, then hold a stable natural end pose and camera framing.', 'continuity final frame'),
  ...[['hard','Hard Cut'],['match','匹配剪辑'],['continuous','连续运动'],['visual','视觉延续'],['fade','Fade'],['reveal','Reveal'],['whip','甩镜转场']].map(([id,label]) => preset('transition', id, label, '编辑或连续性转场。', `Transition: ${label.toLowerCase()} with coherent timing, screen direction, and visual continuity.`)),
  preset('transition', 'i2v-continuation', '精确 I2V 延续', '直接从提供的起始帧继续。', 'Continuity: begin exactly from the supplied first frame; preserve framing, lighting, screen direction, pose, and motion state before introducing the next action.', 'first frame continuation seamless'),
  preset('audio', 'no-dialogue', '无对白', '将音轨锁定为仅环境音与拟音。', 'Sound: natural ambience and synchronized physical sound only; no dialogue, narration, singing, lip-sync, captions, text overlays, or music.', 'silent speech suppress'),
  preset('audio', 'reference-voice', '参考声音角色', '仅使用附加的音频源来获取所需的人声特质。', 'Audio reference: use the assigned audio only for the requested voice timbre, cadence, rhythm, or sound texture; generate a new synchronized target soundtrack.', 'audio 1 voice cadence'),
  preset('style', 'continuity', '连续性优先', '在镜头之间保护身份与场景锚点。', 'Continuity: preserve the assigned identity, wardrobe, location geography, lighting direction, screen direction, and scale; do not merge people, swap outfits, or introduce unassigned props.', 'reference character location'),
  ...[
    ['drone-rise','无人机上升','平滑上升，展现更广阔的地貌。'], ['drone-descent','无人机俯冲','从空中全景俯冲至主体。'], ['jib-reveal','摇臂揭示','越过前景遮挡物上升，呈现干净画面。'],
    ['gimbal-walkthrough','云台跟拍','以人眼高度流畅穿行于环境中。'], ['vehicle-mount','车载固定','保持与移动车辆的刚性相机关系。'], ['parallax-slide','视差横移','横向滑动以分离前景与背景层次。'],
    ['leading-follow','前向跟拍','在行走主体前方后退移动。'], ['trailing-follow','后向跟拍','从后方跟随，保持画面前进方向。'], ['micro-drift','微漂移','添加几乎不可察觉的电影感镜头呼吸。'],
    ['vertigo','推拉变焦','推拉与反向变焦，实现可控的透视变化。'], ['snap-zoom','急推变焦','使用一次有动机的快速变焦来强调节奏点。'], ['tabletop-slider','桌面滑轨','执行短距离精确的产品级滑轨运动。'],
  ].map(([id,label,description]) => preset('camera', id, label, description, `Camera: ${description.toLowerCase()} Keep the move continuous, stabilized, and motivated by the subject's action.`)),
  ...[
    ['establishing','定场镜头','清晰交代场景位置与空间关系。'], ['master','全景镜头','涵盖完整场景及所有主要走位。'], ['group','群像镜头','将多个主体安排为清晰易读的组合构图。'],
    ['reaction','反应镜头','优先呈现角色即时的情绪反应。'], ['cutaway','Cutaway','短暂隔离主体之外的环境动作。'], ['detail','细节特写','展示精确的触觉动作或重要的表面细节。'],
    ['symmetry','对称构图','以刻意的左右平衡将视觉重心置于中央。'], ['negative-space','留白','刻意留出空白空间以强调孤立感或方向感。'],
  ].map(([id,label,description]) => preset('shot', id, label, description, `Shot: ${label.toLowerCase()}; ${description.toLowerCase()} Preserve clean eyelines, headroom, and visual priority.`)),
  ...[
    ['worms-eye','蚁视','极低视角向上仰望。'], ['birds-eye','鸟瞰','高垂直视角俯瞰下方场景。'], ['flat-lay','垂直俯拍平铺','完全垂直的顶视视角。'],
    ['hip-level','腰部高度','低角度对话视角，呈现沉稳的身体语言。'], ['eyeline','视线匹配','匹配已确立的视线方向与主体高度。'], ['subtle-cant','微妙倾斜','施加克制的非水平地平线以营造不安感。'],
  ].map(([id,label,description]) => preset('angle', id, label, description, `Camera angle: ${description.toLowerCase()} Maintain intentional perspective, natural anatomy, and coherent screen direction.`)),
  ...[
    ['14','14mm','戏剧性超广角覆盖，空间纵深感强烈'], ['20','20mm','沉浸式广角透视，边缘畸变受控'], ['40','40mm','广角与正常之间的平衡电影感视角'],
    ['58','58mm','柔和的复古标准压缩，自然层次分离'], ['70','70mm','中焦压缩，营造亲密感'], ['200','200mm','长焦压缩，景深层次强烈分离'],
    ['split','分割屈光镜','近远焦平面同时清晰，具有合理的分界线'], ['tilt','Tilt-Shift','选择性焦平面控制，建筑几何校正'],
  ].map(([id,label,description]) => preset('lens', id, label, description, `Lens: ${label}, ${description}. Preserve physically plausible focus, distortion, and depth of field.`)),
  ...[
    ['rim','轮廓光','受控的边缘光将主体与背景分离。'], ['rembrandt','伦勃朗肖像','柔和的主光在脸颊上形成经典的三角形高光。'], ['butterfly','蝴蝶光肖像','正面高位主光产生干净对称的面部明暗造型。'],
    ['tungsten','钨丝灯动机光','暖色实景灯具为场景主光提供动机。'], ['blue-hour','蓝调时刻','冷调暮色环境光与暖色实景灯光形成平衡。'], ['storm','风暴光','柔和昏暗的日光随远处风暴光照而变化。'],
    ['volumetric','体积光束','可见的动机光束穿过大气薄雾。'], ['projector','投影光','移动的投影影像塑造主体与背景。'], ['fire','Firelight','暖色不规则火光在附近表面自然闪烁。'],
    ['caustics','水纹焦散','柔和移动的反射光斑在表面流动。'], ['mixed','混合色温','冷色环境光与暖色实用光源保持刻意平衡。'], ['bounce','柔光反射','宽幅反射光源产生自然的包裹感和柔和的衰减。'],
  ].map(([id,label,description]) => preset('lighting', id, label, description, `Lighting: ${description} Maintain stable exposure, coherent shadows, realistic skin response, and motivated sources.`)),
  ...[
    ['dialogue','清晰对白','优先保证自然语音清晰可辨，并保持一致的房间透视感。'], ['footsteps','Footsteps','将脚步声与每个可见的接触点和地面材质同步。'], ['cloth','衣物拟音','添加克制的布料摩擦声，与身体动作同步。'],
    ['impact','撞击拟音','为可见的接触赋予精确的重量感和材质特征。'], ['mechanical','机械细节','叠加可信的开关、电机、齿轮和共振声。'], ['kitchen','厨房环境音','使用微妙的电器、厨具、通风和房间底噪。'],
    ['nature','自然底噪','叠加昆虫、树叶、远处野生动物和开阔空间透视感。'], ['ocean','海岸','使用空间感海浪、风、泡沫和远处海岸环境音。'], ['thunder','远处雷声','将低沉的远处雷声自然地置于即时环境音之后。'],
    ['reverb','大房间混响','将人声和音效匹配到令人信服的大型室内声学环境。'], ['close-mic','亲密近距拾音','捕捉细腻的呼吸与声音，保持克制的空间感。'], ['distant','远景视角','将声源置于远处，带有恰当的空气感与反射。'],
  ].map(([id,label,description]) => preset('audio', id, label, description, `Sound: ${description} Keep timing synchronized, spatial placement coherent, levels natural, and add no unnecessary music.`)),
  ...[
    ['16mm','16mm Film','质感颗粒、柔和光晕与紧凑的纪实色彩。'], ['35mm','35mm Film','细腻颗粒、胶片感高光滚降与克制的电影色彩。'], ['70mm','70mm Epic','大画幅清晰度、立体纵深感与精致的自然色彩。'],
    ['noir','经典黑色电影','单色对比、雕塑感阴影与精准的光斑。'], ['neo-noir','新黑色','深邃暗部、选择性饱和色彩与都市氛围质感。'], ['retro-future','复古未来主义','乐观的模拟科技、触感材质与时代色彩设计。'],
    ['period','年代剧','基于历史考据的材质、克制的色调与优雅的构图。'], ['horror','心理恐怖','克制的留白、不安的静谧与压迫感的实景光。'], ['romance','爱情剧','柔和的分离感、亲密的取景与温暖克制的色彩。'],
    ['music-video','音乐视频','大胆的图形构图、节奏感能量与精致的灯光。'], ['fashion','时尚大片','雕塑感姿态、精致的表面与精准的编辑光。'], ['indie','独立电影','自然的表演、可用光质感与克制的镜头语言。'],
  ].map(([id,label,description]) => preset('style', id, label, description, `Visual treatment: ${description.toLowerCase()} Keep materials credible and the grade consistent throughout the shot.`)),
  ...[
    ['walk','自然行走','以真实的步频节奏、平衡感和手臂摆动自然行走。'], ['run','受控奔跑','以连贯的步态、动量和身体力学自然奔跑。'], ['turn','转向镜头','头部和躯干以一次连贯动作自然转向镜头。'],
    ['glance','微妙注视','先移动视线，再配合克制的头部转动。'], ['sit','Sit Down','以可信的平衡、接触和布料响应自然落座。'], ['stand','站起','以自然的重心转移和稳定的站姿起身。'],
    ['reach','Reach','手臂伸展时肩部协同参与，手部精准指向目标。'], ['pickup','拾取物体','以可信的接触和重量感抓握、提起并放稳物体。'], ['gesture','对话手势','配合语音节奏使用克制的自然手势。'],
    ['hair','头发动态','让头发对动作、重力和局部气流产生微妙反应。'], ['fabric','布料响应','让衣物随身体运动自然折叠和垂落。'], ['crowd','背景人群','保持多样化的低优先级背景动态，避免令人分心的重复。'],
    ['vehicle','车辆运动','保持可信的加速度、悬挂、轮胎接触和环境视差。'], ['dance','编排舞蹈','保持有节奏的全身协调和一致的人体结构。'], ['fight','受控动作节拍','编排一次清晰可辨的交锋，保持安全距离、准确的打击时机，无解剖结构畸变。'],
  ].map(([id,label,description]) => preset('movement', id, label, description, `Action: ${description} Maintain identity, anatomy, contact, momentum, and continuity from start to finish.`)),
  ...[
    ['dissolve','交叉溶解','通过有意的重叠平滑地融合两个时刻。'], ['dip-black','淡出至黑','短暂经过黑场以标记明确的断点。'], ['foreground-wipe','前景擦除','让附近的移动物体自然地覆盖画面。'],
    ['occlusion','遮挡转场','将剪辑隐藏在满幅遮挡物之后。'], ['iris','光圈转场','通过受控的圆形遮罩打开或关闭可见画面。'], ['timelapse','延时摄影转场','压缩环境变化，同时保持固定的视觉锚点。'],
    ['speed-ramp','速度渐变','围绕一个有动机的动作节拍平滑地改变播放节奏。'], ['focus','焦点转场','通过干净且有动机的焦点转移在主体之间移动注意力。'],
  ].map(([id,label,description]) => preset('transition', id, label, description, `Transition: ${description} Preserve composition, screen direction, timing, and the intended narrative connection.`)),
  ...[
    ['push-past','推过前景','越过近处前景元素进入动作场景。'], ['reveal-doorway','门框揭示','通过门框或画框进入或揭示场景。'], ['locked-portrait','锁定肖像','保持亲密的肖像构图，不重新取景。'], ['tabletop-orbit','桌面环绕','近距离环绕产品或道具，带有可控的视差。'], ['focus-rack-near','移焦至近处','将焦点从背景转移到近处主体。'], ['focus-rack-far','移焦至远处','将焦点从近处物体转移到背景动作。'],
  ].map(([id,label,description]) => preset('camera', id, label, description, `Camera: ${description.toLowerCase()} Keep focus, movement, and perspective physically plausible.`)),
  ...[
    ['clean-plate','空板','保持空环境，用于合成或剪辑点。'], ['product-hero','产品主角','展示一个物体，具有清晰的轮廓和表面细节。'], ['silhouette-profile','侧面剪影','使用可辨识的侧面剪影，背景分离。'], ['dialogue-coverage','对话覆盖镜头','保持视线、头顶空间和画面方向一致，以便剪辑。'],
  ].map(([id,label,description]) => preset('shot', id, label, description, `Shot: ${description}. Preserve clean composition and the intended editorial purpose.`)),
  ...[
    ['softbox','柔光箱主光','大型柔光棚灯，柔和的包裹感与可控的阴影。'], ['motivated-window','动机窗光','使用画外窗户作为可信的方向性主光。'], ['night-exterior','夜景外景','平衡实用灯光池与可辨识的阴影细节。'], ['overhead-practical','顶部实用灯','让天花板实用灯塑造场景，带有自然的光衰减。'],
  ].map(([id,label,description]) => preset('lighting', id, label, description, `Lighting: ${description}. Maintain motivated sources, stable exposure, and believable shadows.`)),
  ...[
    ['breath','呼吸声与环境音','保持近距离自然呼吸声微妙，与房间透视相协调。'], ['rain-interior','雨打玻璃','将雨声、远处交通声和柔和的室内环境音置于动作背景之后。'], ['market','市场氛围','使用层次分明的远处人声、动态声和摊位声，不要盖过对白。'], ['club','俱乐部内景','使用克制的低频溢出、人群质感和房间反射。'],
  ].map(([id,label,description]) => preset('audio', id, label, description, `Sound: ${description}. Keep the mix synchronized, natural, and appropriate to the visible space.`)),
]

export const promptPresetCategories: Array<{ id: PromptPresetCategory; label: string }> = [
  { id: 'camera', label: 'Camera' }, { id: 'shot', label: 'Shot' }, { id: 'angle', label: 'Angle' }, { id: 'lens', label: 'Lens' },
  { id: 'lighting', label: 'Lighting' }, { id: 'audio', label: 'Audio' }, { id: 'style', label: 'Style' }, { id: 'movement', label: 'Movement' }, { id: 'transition', label: 'Transition' }, { id: 'continuity', label: 'Continuity' }, { id: 'character', label: 'Character' }, { id: 'wardrobe', label: 'Wardrobe' }, { id: 'location', label: 'Location' },
]

export function promptCommandScore(item: { category: string; label: string; description: string; keywords?: string[]; meta?: string }, query: string) {
  const normalized = query.toLowerCase().trim()
  if (!normalized) return 0
  const label = item.label.toLowerCase()
  const searchable = `${item.category} ${label} ${item.description} ${(item.keywords ?? []).join(' ')} ${item.meta ?? ''}`.toLowerCase()
  const tokens = searchable.split(/[^\p{L}\p{N}]+/u)
  const fuzzy = (word: string) => word.length >= 3 && tokens.some((token) => {
    if (token[0] !== word[0]) return false
    let index = 0
    for (const character of token) if (character === word[index]) index += 1
    return index === word.length
  })
  const words = normalized.split(/\s+/)
  if (!words.every((word) => searchable.includes(word) || fuzzy(word))) return Infinity
  if (label === normalized) return 0
  if (label.startsWith(normalized)) return 1
  if (label.includes(normalized)) return 2
  if (words.every((word) => searchable.includes(word))) return 3
  return 4
}

export function searchPromptPresets(query: string) {
  return promptPresets.filter((item) => Number.isFinite(promptCommandScore(item, query)))
    .sort((a, b) => promptCommandScore(a, query) - promptCommandScore(b, query))
}

export function findPromptCommands(query: string, category: 'all' | PromptPresetCategory) {
  return promptPresets
    .filter(item => category === 'all' || item.category === category)
    .map(item => ({ item, score: promptCommandScore(item, query) }))
    .filter(result => Number.isFinite(result.score))
    .sort((a, b) => a.score - b.score || a.item.label.localeCompare(b.item.label))
    .map(result => result.item)
}
