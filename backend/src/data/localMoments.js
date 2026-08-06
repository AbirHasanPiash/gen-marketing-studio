/**
 * Curated dataset of Bangladeshi retail & cultural moments (Feature 6).
 * The campaign suggester matches upcoming moments to the calendar and drafts
 * themed campaigns. `month`/`day` are the (approximate) Gregorian anchors;
 * religious dates shift yearly, so these are used as a proximity heuristic.
 */
export const LOCAL_MOMENTS = [
  {
    key: 'pohela-boishakh',
    name: 'Pohela Boishakh',
    subtitle: 'Bengali New Year',
    month: 4,
    day: 14,
    emoji: '🌸',
    colors: ['#E63946', '#FFFFFF', '#F1A208'],
    themes: ['festive', 'traditional', 'red-and-white', 'panta-ilish'],
    description:
      'The biggest secular festival in Bangladesh. Red-and-white fashion, alpona art, and mela sales dominate retail.',
    sampleAngle: 'Celebrate Noboborsho with a fresh collection — bundle offers & festive packaging.',
  },
  {
    key: 'eid-ul-fitr',
    name: 'Eid-ul-Fitr',
    subtitle: 'Eid after Ramadan',
    month: 4,
    day: 10,
    emoji: '🌙',
    colors: ['#2A9D8F', '#E9C46A', '#FFFFFF'],
    themes: ['premium', 'gifting', 'panjabi-saree', 'eid-collection'],
    description:
      'The single largest shopping season. Apparel, gifts, and food see peak demand in the weeks before Eid.',
    sampleAngle: 'Launch your Eid Collection early — highlight limited stock and free delivery before Eid.',
  },
  {
    key: 'eid-ul-adha',
    name: 'Eid-ul-Adha',
    subtitle: 'Qurbani Eid',
    month: 6,
    day: 17,
    emoji: '🐄',
    colors: ['#264653', '#2A9D8F', '#E9C46A'],
    themes: ['gifting', 'home', 'kitchen', 'freshness'],
    description:
      'Focus on home, kitchen, spices, freezers, and family gatherings around Qurbani.',
    sampleAngle: 'Get Qurbani-ready — kitchen essentials, spice bundles and storage deals.',
  },
  {
    key: 'ekushey-february',
    name: 'Ekushey February',
    subtitle: 'International Mother Language Day',
    month: 2,
    day: 21,
    emoji: '🕊️',
    colors: ['#000000', '#E63946', '#FFFFFF'],
    themes: ['heritage', 'respectful', 'black-and-white', 'bookish'],
    description:
      'A solemn day honouring the Language Movement. Books, ekushey boi mela, and heritage themes resonate.',
    sampleAngle: 'Honour our mother tongue — a curated Boi Mela reading list & respectful brand tribute.',
  },
  {
    key: 'pohela-falgun',
    name: 'Pohela Falgun',
    subtitle: 'First day of spring',
    month: 2,
    day: 13,
    emoji: '🌼',
    colors: ['#F1A208', '#E76F51', '#FCBF49'],
    themes: ['floral', 'yellow-basanti', 'youthful', 'spring'],
    description:
      'Basanti yellow fashion, flower crowns, and a youthful, romantic mood take over campuses and cafés.',
    sampleAngle: 'Basanti vibes are here — style your spring look in marigold yellow.',
  },
  {
    key: 'valentines',
    name: "Valentine's Day",
    subtitle: 'Bhalobasha Dibosh',
    month: 2,
    day: 14,
    emoji: '❤️',
    colors: ['#E63946', '#FF6B6B', '#FFFFFF'],
    themes: ['romantic', 'gifting', 'couples', 'red'],
    description:
      'Overlaps with Falgun. Couple gifting, dining, and “his & hers” bundles perform well.',
    sampleAngle: 'Gift love this Bhalobasha Dibosh — couple bundles with a free handwritten note.',
  },
  {
    key: 'independence-day',
    name: 'Independence Day',
    subtitle: '26 March',
    month: 3,
    day: 26,
    emoji: '🇧🇩',
    colors: ['#006A4E', '#F42A41', '#FFFFFF'],
    themes: ['patriotic', 'green-and-red', 'proud', 'deshi'],
    description:
      'National pride. Deshi-made, green-and-red creatives and “Made in Bangladesh” angles shine.',
    sampleAngle: 'Proudly deshi — 26% off to celebrate our Independence. Made in Bangladesh 🇧🇩',
  },
  {
    key: 'victory-day',
    name: 'Victory Day',
    subtitle: 'Bijoy Dibosh · 16 December',
    month: 12,
    day: 16,
    emoji: '🎖️',
    colors: ['#006A4E', '#F42A41', '#264653'],
    themes: ['patriotic', 'winter', 'proud', 'year-end'],
    description:
      'National victory celebration in peak winter — combine patriotic pride with year-end winter sales.',
    sampleAngle: 'Bijoy Dibosh salute — 16 December flash sale on our winter range.',
  },
  {
    key: 'ramadan',
    name: 'Ramadan',
    subtitle: 'The holy month',
    month: 3,
    day: 1,
    emoji: '🕌',
    colors: ['#2A9D8F', '#264653', '#E9C46A'],
    themes: ['iftar', 'modest', 'community', 'dates-and-food'],
    description:
      'Iftar bundles, modest wear, dates, and pre-Eid teasers. Evening engagement spikes after iftar.',
    sampleAngle: 'Ramadan Mubarak — iftar essentials & modest fits, delivered before Maghrib.',
  },
  {
    key: 'winter-season',
    name: 'Winter Season',
    subtitle: 'Poush–Magh',
    month: 12,
    day: 20,
    emoji: '🧣',
    colors: ['#457B9D', '#1D3557', '#A8DADC'],
    themes: ['cozy', 'sweaters', 'pitha', 'warm-tones'],
    description:
      'Sweaters, blankets, moisturisers, and pitha season. Cozy, warm-toned creatives convert well.',
    sampleAngle: 'Winter is coming — cozy up with our sweater collection & warm bundle deals.',
  },
  {
    key: 'durga-puja',
    name: 'Durga Puja',
    subtitle: 'Sharodiya',
    month: 10,
    day: 10,
    emoji: '🪔',
    colors: ['#E63946', '#F1A208', '#9D0208'],
    themes: ['festive', 'ethnic', 'red-and-gold', 'sharodiya'],
    description:
      'Major festival for the Hindu community — ethnic wear, gifting, and pandal-hopping fashion.',
    sampleAngle: 'Sharodiya Shubhechha — festive ethnic wear for every pandal look.',
  },
  {
    key: 'back-to-school',
    name: 'Back to School',
    subtitle: 'January admissions',
    month: 1,
    day: 5,
    emoji: '🎒',
    colors: ['#457B9D', '#F1A208', '#2A9D8F'],
    themes: ['stationery', 'youthful', 'value', 'fresh-start'],
    description:
      'New academic year. Stationery, bags, gadgets, and uniforms see a demand bump.',
    sampleAngle: 'New year, new class — back-to-school combos with student discounts.',
  },
  {
    key: 'eleven-eleven',
    name: '11.11 Mega Sale',
    subtitle: 'Singles / mega sale day',
    month: 11,
    day: 11,
    emoji: '🛒',
    colors: ['#E76F51', '#F4A261', '#264653'],
    themes: ['sale', 'urgency', 'flash', 'e-commerce'],
    description:
      'E-commerce mega-sale day adopted across BD marketplaces — urgency, countdowns, and bundles.',
    sampleAngle: '11.11 is LIVE — up to 50% off for 24 hours only. Set your alarm ⏰',
  },
  {
    key: 'black-friday',
    name: 'Black Friday',
    subtitle: 'Year-end mega sale',
    month: 11,
    day: 28,
    emoji: '🖤',
    colors: ['#000000', '#E9C46A', '#264653'],
    themes: ['sale', 'urgency', 'premium', 'flash'],
    description:
      'Global sale event increasingly popular in BD online retail — deep discounts and doorbusters.',
    sampleAngle: 'Black Friday doorbusters — our biggest discounts of the year, while stocks last.',
  },
];

/** Days until the next occurrence of month/day from a reference date. */
function daysUntil(month, day, from) {
  const year = from.getFullYear();
  let target = new Date(year, month - 1, day);
  if (target < from) target = new Date(year + 1, month - 1, day);
  return Math.ceil((target - from) / (1000 * 60 * 60 * 24));
}

/** Moments coming up within `withinDays`, nearest first. */
export function upcomingMoments(from = new Date(), withinDays = 60) {
  return LOCAL_MOMENTS.map((m) => ({ ...m, inDays: daysUntil(m.month, m.day, from) }))
    .filter((m) => m.inDays <= withinDays)
    .sort((a, b) => a.inDays - b.inDays);
}

export const getMoment = (key) => LOCAL_MOMENTS.find((m) => m.key === key);
