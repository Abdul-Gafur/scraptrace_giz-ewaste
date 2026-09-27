import type { EwasteCategory, SupportedLanguage } from "@scraptrace/contracts";

/**
 * Reviewed demonstration safety content.
 *
 * Every answer set is conservative and refers the reader to an approved receiving location or a
 * trained technician instead of describing any dismantling step. The `sources` are real public
 * guidance documents cited by title; they are recorded as the basis a programme reviewer would
 * verify before approval, not as generated facts.
 *
 * Coverage is deliberately incomplete: French, Arabic and Portuguese cover a subset, so the
 * missing-translation and approved-fallback behaviour is demonstrable rather than hidden behind
 * silently substituted English.
 */

export interface SeedAnswers {
  readonly what_is_it: string;
  readonly possible_dangers: string;
  readonly prohibited_actions: string;
  readonly safe_actions_now: string;
  readonly suitable_destination: string;
}

export const SAFETY_SOURCES = [
  {
    label: "Basel Convention technical guidelines on transboundary movements of e-waste",
    reference: "Basel Convention Secretariat, technical guidelines on e-waste and used equipment",
  },
  {
    label: "WHO, Children and digital dumpsites: e-waste exposure and child health (2021)",
    reference: "World Health Organization report on e-waste exposure and child health, 2021",
  },
  {
    label: "ILO, Decent work in the management of electrical and electronic waste",
    reference: "International Labour Organization sectoral report on e-waste work",
  },
] as const;

const ENGLISH: Record<EwasteCategory, SeedAnswers> = {
  refrigerators: {
    what_is_it:
      "A household or commercial refrigerator or freezer. It contains a sealed cooling circuit, an insulated cabinet and a compressor unit at the back or base.",
    possible_dangers:
      "The cooling circuit and the insulation foam can hold refrigerant gases that harm health and the climate when released. Older units may contain oil, sharp metal edges and heavy doors. A unit lying on its side can leak oil.",
    prohibited_actions:
      "Do not cut, puncture or open any pipe, and do not remove the compressor. Do not burn any part of the unit or its foam insulation. Do not leave the door able to close with a child inside.",
    safe_actions_now:
      "Keep the unit upright and stable. Empty and clean the inside, remove loose shelves and tape the door closed or remove it entirely where the door can be latched. Move it with a second person or a trolley.",
    suitable_destination:
      "Take the unit to a programme-verified recycler or collection centre that accepts refrigeration equipment, so the refrigerant can be recovered by a trained technician.",
  },
  laptops_and_desktop_computers: {
    what_is_it:
      "A laptop, desktop tower, all-in-one computer or server unit, including its internal battery, circuit boards and storage drive.",
    possible_dangers:
      "A lithium battery that is swollen, punctured or wet can overheat and catch fire. Circuit boards contain lead and other metals. The unit may still hold personal files.",
    prohibited_actions:
      "Do not press, bend, puncture or charge a swollen or damaged battery. Do not burn the device or any board. Do not break boards apart to separate metals.",
    safe_actions_now:
      "Shut the device down and disconnect the charger. Sign out and delete personal files if the device still starts. Keep it dry and at room temperature, away from anything flammable.",
    suitable_destination:
      "Take the device to a programme-verified recycler or collection centre that accepts computers, or to a repair or reuse service if the device still works.",
  },
  televisions: {
    what_is_it:
      "A television set. Older sets use a heavy glass cathode-ray tube; flat sets use a panel with a backlight and a power board.",
    possible_dangers:
      "Cathode-ray tube glass contains lead and is under vacuum, so it can break sharply. Some older flat-panel backlights contain small mercury lamps. Power boards hold charge after unplugging.",
    prohibited_actions:
      "Do not break the screen or the tube, and do not remove the back cover. Do not burn the set. Do not drag a large set alone.",
    safe_actions_now:
      "Unplug the set and leave it standing upright on a flat surface. If the screen is already cracked, keep people and animals away, avoid sweeping dry fragments, and cover it loosely.",
    suitable_destination:
      "Take the set to a programme-verified recycler or collection centre that accepts televisions and screen glass.",
  },
  microwaves: {
    what_is_it:
      "A microwave oven. It contains a high-voltage transformer, a capacitor and a magnetron behind the outer case.",
    possible_dangers:
      "The internal capacitor can hold a dangerous charge long after the oven is unplugged. The magnetron contains ceramic parts that are harmful if broken and inhaled. The case has sharp edges.",
    prohibited_actions:
      "Do not open the outer case for any reason. Do not touch internal parts. Do not burn the oven or run it with the door damaged.",
    safe_actions_now:
      "Unplug the oven, wipe the inside clean and tape the door closed. Keep the case intact and store the oven dry until transport.",
    suitable_destination:
      "Take the oven to a programme-verified recycler or collection centre that accepts small appliances, so a trained technician can discharge and open it.",
  },
  air_conditioners: {
    what_is_it:
      "A window, split or portable air-conditioning unit, including its indoor unit, outdoor unit and connecting pipework.",
    possible_dangers:
      "The sealed circuit holds refrigerant gas under pressure that harms health and the climate when released, and can cause cold burns. Units are heavy and may hold standing water and mould.",
    prohibited_actions:
      "Do not cut or disconnect refrigerant pipework yourself, and do not vent the gas. Do not burn any part. Do not lift an outdoor unit alone.",
    safe_actions_now:
      "Switch off and isolate the power. Leave the pipework sealed and the unit upright. Drain visible water, and wear gloves for sharp fins.",
    suitable_destination:
      "Arrange collection by a programme-verified recycler with refrigerant-recovery capability, or a licensed refrigeration technician.",
  },
  compressors: {
    what_is_it:
      "A compressor unit removed from refrigeration or air-conditioning equipment, or a standalone air compressor with a pressure vessel.",
    possible_dangers:
      "A compressor can retain oil and residual refrigerant under pressure. A pressure vessel can fail violently if heated or cut. The unit is dense and heavy for its size.",
    prohibited_actions:
      "Do not cut, drill, grind or heat the housing or any vessel. Do not drain oil to the ground or a drain. Do not burn the unit.",
    safe_actions_now:
      "Keep the compressor upright, in a tray or on a sealed surface to catch any drip, and out of direct sun. Use gloves and lift with help.",
    suitable_destination:
      "Take the compressor to a programme-verified recycler that accepts refrigeration components and can recover oil and refrigerant.",
  },
  mixed_scrap: {
    what_is_it:
      "A mixed batch of electrical and electronic scrap declared by weight rather than as one identifiable item.",
    possible_dangers:
      "A mixed batch can hide batteries, screen glass, lamps, capacitors and cables together, so hazards are unpredictable. Sharp edges and dust are likely. Batteries mixed with metal can short and ignite.",
    prohibited_actions:
      "Do not burn or melt any part of the batch, and do not strip cable by burning. Do not break screens or lamps to reduce volume. Do not store batteries loose with metal scrap.",
    safe_actions_now:
      "Keep the batch dry and covered. Separate any visible battery into a non-metal container and set screens aside intact. Record the approximate weight before transport, and wear gloves.",
    suitable_destination:
      "Deliver the batch to a programme-verified recycler or collection centre that accepts mixed e-waste and can sort it safely.",
  },
};

const FRENCH: Partial<Record<EwasteCategory, SeedAnswers>> = {
  refrigerators: {
    what_is_it:
      "Un réfrigérateur ou un congélateur domestique ou commercial. Il contient un circuit de froid scellé, une caisse isolée et un compresseur à l'arrière ou à la base.",
    possible_dangers:
      "Le circuit de froid et la mousse isolante peuvent contenir des gaz réfrigérants nocifs pour la santé et le climat en cas de fuite. Les appareils anciens peuvent contenir de l'huile, présenter des bords métalliques coupants et des portes lourdes. Un appareil couché sur le côté peut fuir.",
    prohibited_actions:
      "Ne coupez, ne percez et n'ouvrez aucun tuyau, et ne retirez pas le compresseur. Ne brûlez aucune partie de l'appareil ni sa mousse isolante. Ne laissez pas la porte pouvoir se refermer sur un enfant.",
    safe_actions_now:
      "Maintenez l'appareil debout et stable. Videz et nettoyez l'intérieur, retirez les clayettes et scotchez la porte ou retirez-la. Déplacez l'appareil à deux ou avec un chariot.",
    suitable_destination:
      "Apportez l'appareil à un recycleur ou un centre de collecte vérifié par le programme qui accepte les équipements de froid, afin qu'un technicien qualifié récupère le réfrigérant.",
  },
  televisions: {
    what_is_it:
      "Un téléviseur. Les modèles anciens utilisent un tube cathodique en verre lourd ; les modèles plats utilisent une dalle avec un rétroéclairage et une carte d'alimentation.",
    possible_dangers:
      "Le verre du tube cathodique contient du plomb et est sous vide : il peut se briser en éclats coupants. Certains rétroéclairages anciens contiennent de petites lampes au mercure. Les cartes d'alimentation restent chargées après le débranchement.",
    prohibited_actions:
      "Ne brisez pas l'écran ni le tube et ne retirez pas le capot arrière. Ne brûlez pas le téléviseur. Ne traînez pas seul un grand téléviseur.",
    safe_actions_now:
      "Débranchez le téléviseur et laissez-le debout sur une surface plane. Si l'écran est déjà fissuré, éloignez les personnes et les animaux, ne balayez pas les fragments à sec et couvrez-le sans serrer.",
    suitable_destination:
      "Apportez le téléviseur à un recycleur ou un centre de collecte vérifié par le programme qui accepte les téléviseurs et le verre d'écran.",
  },
  laptops_and_desktop_computers: {
    what_is_it:
      "Un ordinateur portable, une tour, un ordinateur tout-en-un ou un serveur, avec sa batterie interne, ses cartes électroniques et son disque de stockage.",
    possible_dangers:
      "Une batterie au lithium gonflée, percée ou mouillée peut surchauffer et prendre feu. Les cartes électroniques contiennent du plomb et d'autres métaux. L'appareil peut encore contenir des fichiers personnels.",
    prohibited_actions:
      "N'appuyez pas sur une batterie gonflée, ne la pliez pas, ne la percez pas et ne la chargez pas. Ne brûlez ni l'appareil ni les cartes. Ne cassez pas les cartes pour séparer les métaux.",
    safe_actions_now:
      "Éteignez l'appareil et débranchez le chargeur. Déconnectez vos comptes et supprimez les fichiers personnels si l'appareil démarre encore. Gardez-le sec, à température ambiante, loin de tout produit inflammable.",
    suitable_destination:
      "Apportez l'appareil à un recycleur ou un centre de collecte vérifié par le programme qui accepte les ordinateurs, ou à un service de réparation ou de réemploi s'il fonctionne encore.",
  },
  air_conditioners: {
    what_is_it:
      "Un climatiseur de fenêtre, un split ou un modèle mobile, avec son unité intérieure, son unité extérieure et ses liaisons frigorifiques.",
    possible_dangers:
      "Le circuit scellé contient un gaz réfrigérant sous pression, nocif pour la santé et le climat en cas de fuite, et pouvant causer des brûlures par le froid. Les unités sont lourdes et peuvent contenir de l'eau stagnante et des moisissures.",
    prohibited_actions:
      "Ne coupez pas et ne débranchez pas vous-même les liaisons frigorifiques, et ne libérez pas le gaz. Ne brûlez aucune partie. Ne soulevez pas seul une unité extérieure.",
    safe_actions_now:
      "Coupez et isolez l'alimentation. Laissez les liaisons scellées et l'unité debout. Videz l'eau visible et portez des gants à cause des ailettes coupantes.",
    suitable_destination:
      "Faites enlever l'appareil par un recycleur vérifié par le programme disposant d'une capacité de récupération des réfrigérants, ou par un technicien frigoriste agréé.",
  },
  microwaves: {
    what_is_it:
      "Un four à micro-ondes. Il contient un transformateur haute tension, un condensateur et un magnétron derrière le capot.",
    possible_dangers:
      "Le condensateur interne peut conserver une charge dangereuse longtemps après le débranchement. Le magnétron contient des pièces céramiques nocives si elles sont brisées et inhalées. Le capot présente des bords coupants.",
    prohibited_actions:
      "N'ouvrez le capot sous aucun prétexte. Ne touchez pas les pièces internes. Ne brûlez pas le four et ne le faites pas fonctionner si la porte est endommagée.",
    safe_actions_now:
      "Débranchez le four, nettoyez l'intérieur et scotchez la porte. Gardez le capot intact et stockez le four au sec jusqu'au transport.",
    suitable_destination:
      "Apportez le four à un recycleur ou un centre de collecte vérifié par le programme qui accepte le petit électroménager, pour qu'un technicien qualifié le décharge et l'ouvre.",
  },
  compressors: {
    what_is_it:
      "Un compresseur retiré d'un équipement de froid ou de climatisation, ou un compresseur d'air autonome avec réservoir sous pression.",
    possible_dangers:
      "Un compresseur peut retenir de l'huile et un reste de réfrigérant sous pression. Un réservoir sous pression peut se rompre violemment s'il est chauffé ou découpé. L'appareil est dense et lourd pour sa taille.",
    prohibited_actions:
      "Ne découpez pas, ne percez pas, ne meulez pas et ne chauffez pas le corps ni aucun réservoir. Ne videz pas l'huile au sol ni à l'égout. Ne brûlez pas l'appareil.",
    safe_actions_now:
      "Gardez le compresseur debout, dans un bac ou sur une surface étanche pour recueillir les égouttures, et à l'abri du soleil. Portez des gants et soulevez à deux.",
    suitable_destination:
      "Apportez le compresseur à un recycleur vérifié par le programme qui accepte les composants de froid et peut récupérer l'huile et le réfrigérant.",
  },
};

const ARABIC: Partial<Record<EwasteCategory, SeedAnswers>> = {
  refrigerators: {
    what_is_it:
      "ثلاجة أو مجمّد منزلي أو تجاري. يحتوي على دائرة تبريد مُحكمة الإغلاق وهيكل معزول وضاغط في الخلف أو في القاعدة.",
    possible_dangers:
      "قد تحتوي دائرة التبريد ورغوة العزل على غازات تبريد تضر بالصحة وبالمناخ عند تسربها. وقد تحتوي الأجهزة القديمة على زيت وحواف معدنية حادة وأبواب ثقيلة. والجهاز الموضوع على جانبه قد يسرّب الزيت.",
    prohibited_actions:
      "لا تقطع أو تثقب أو تفتح أي أنبوب، ولا تُزل الضاغط. لا تحرق أي جزء من الجهاز أو من رغوة العزل. لا تترك الباب قادرًا على الإغلاق على طفل بالداخل.",
    safe_actions_now:
      "أبقِ الجهاز قائمًا وثابتًا. أفرِغ الداخل ونظّفه، وأزل الأرفف، والصق الباب أو انزعه. حرّك الجهاز بمساعدة شخص آخر أو بعربة نقل.",
    suitable_destination:
      "خُذ الجهاز إلى جهة إعادة تدوير أو مركز تجميع معتمد من البرنامج يقبل أجهزة التبريد، ليستخرج فنيّ مدرَّب غاز التبريد.",
  },
  televisions: {
    what_is_it:
      "جهاز تلفاز. تستخدم الأجهزة القديمة أنبوب أشعة مهبطية من زجاج ثقيل، أما الأجهزة المسطحة فتستخدم شاشة مع إضاءة خلفية ولوحة تغذية.",
    possible_dangers:
      "يحتوي زجاج أنبوب الأشعة المهبطية على الرصاص وهو مفرَّغ من الهواء، لذا قد ينكسر بحدة. وتحتوي بعض الإضاءات الخلفية القديمة على مصابيح زئبق صغيرة. وتبقى لوحات التغذية محمَّلة بالكهرباء بعد فصل القابس.",
    prohibited_actions:
      "لا تكسر الشاشة أو الأنبوب، ولا تُزل الغطاء الخلفي. لا تحرق الجهاز. لا تجرّ جهازًا كبيرًا بمفردك.",
    safe_actions_now:
      "افصل القابس واترك الجهاز قائمًا على سطح مستوٍ. إذا كانت الشاشة متشققة بالفعل، فأبعد الناس والحيوانات، ولا تكنس الشُظايا وهي جافة، وغطِّ الجهاز تغطية غير محكمة.",
    suitable_destination:
      "خُذ الجهاز إلى جهة إعادة تدوير أو مركز تجميع معتمد من البرنامج يقبل أجهزة التلفاز وزجاج الشاشات.",
  },
};

const PORTUGUESE: Partial<Record<EwasteCategory, SeedAnswers>> = {
  refrigerators: {
    what_is_it:
      "Um refrigerador ou congelador doméstico ou comercial. Contém um circuito de frio selado, uma caixa isolada e um compressor na parte de trás ou na base.",
    possible_dangers:
      "O circuito de frio e a espuma de isolamento podem conter gases refrigerantes que prejudicam a saúde e o clima quando libertados. Aparelhos antigos podem conter óleo, arestas metálicas cortantes e portas pesadas. Um aparelho deitado de lado pode verter óleo.",
    prohibited_actions:
      "Não corte, perfure nem abra qualquer tubo, e não retire o compressor. Não queime nenhuma parte do aparelho nem a espuma de isolamento. Não deixe a porta em condições de fechar com uma criança dentro.",
    safe_actions_now:
      "Mantenha o aparelho em pé e estável. Esvazie e limpe o interior, retire as prateleiras soltas e fixe a porta com fita ou retire-a. Movimente-o com outra pessoa ou com um carrinho.",
    suitable_destination:
      "Leve o aparelho a um reciclador ou centro de recolha verificado pelo programa que aceite equipamento de refrigeração, para que um técnico com formação recupere o refrigerante.",
  },
  laptops_and_desktop_computers: {
    what_is_it:
      "Um computador portátil, uma torre, um computador tudo-em-um ou um servidor, incluindo a bateria interna, as placas de circuito e o disco de armazenamento.",
    possible_dangers:
      "Uma bateria de lítio inchada, perfurada ou molhada pode sobreaquecer e incendiar-se. As placas de circuito contêm chumbo e outros metais. O equipamento pode ainda conter ficheiros pessoais.",
    prohibited_actions:
      "Não pressione, dobre, perfure nem carregue uma bateria inchada ou danificada. Não queime o equipamento nem as placas. Não parta placas para separar metais.",
    safe_actions_now:
      "Desligue o equipamento e retire o carregador. Termine as sessões e elimine ficheiros pessoais se o equipamento ainda arrancar. Mantenha-o seco, à temperatura ambiente e longe de materiais inflamáveis.",
    suitable_destination:
      "Leve o equipamento a um reciclador ou centro de recolha verificado pelo programa que aceite computadores, ou a um serviço de reparação ou reutilização se ainda funcionar.",
  },
};

export const SEED_SAFETY_CONTENT: Readonly<
  Record<SupportedLanguage, Partial<Record<EwasteCategory, SeedAnswers>>>
> = {
  en: ENGLISH,
  fr: FRENCH,
  ar: ARABIC,
  pt: PORTUGUESE,
};
