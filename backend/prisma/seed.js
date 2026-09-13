 
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import QRCode from 'qrcode';
import { encrypt } from '../src/lib/crypto.js';
import { env } from '../src/config/env.js';

const prisma = new PrismaClient();

/* ---------------------------------------------------------------------------
 * Everything below is hand-authored: fixed copy, fixed imagery seeds and fixed
 * engagement figures. Nothing is randomised, so every run produces the same
 * demo workspace and the charts tell the same story — festive campaigns beat
 * evergreen posts, Friday evenings beat Monday mornings, Instagram out-reaches
 * Facebook. That makes the seed useful for screenshots and for eyeballing a
 * regression, which random numbers never are.
 * ------------------------------------------------------------------------- */

const img = (prompt, seed, w = 1024, h = 1024) =>
  `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&seed=${seed}&nologo=true&model=flux`;

/**
 * The most recent `weekday` (0 = Sunday), `weeksBack` weeks earlier, at `hour`.
 * Anchoring posts to real weekdays is what makes "best day / best hour to post"
 * show a genuine pattern rather than noise.
 */
function on(weekday, hour, weeksBack = 0) {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  const back = (d.getDay() - weekday + 7) % 7 || 7; // always at least one day ago
  d.setDate(d.getDate() - back - weeksBack * 7);
  return d;
}

const daysAgo = (n, hour = 12) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d;
};

const daysAhead = (n, hour = 20) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(hour, 0, 0, 0);
  return d;
};

/**
 * Derive a full metric set from the two numbers we actually care about —
 * impressions and the engagement rate this post should display. Keeps the
 * split between likes / comments / shares / saves consistent everywhere.
 */
function metrics(impressions, ratePct) {
  const actions = Math.round((impressions * ratePct) / 100);
  const likes = Math.round(actions * 0.68);
  const comments = Math.round(actions * 0.11);
  const shares = Math.round(actions * 0.13);
  return {
    impressions,
    reach: Math.round(impressions * 0.78),
    views: impressions,
    likes,
    comments,
    shares,
    saves: actions - likes - comments - shares,
    clicks: Math.round(actions * 0.42),
    engagement: ratePct,
  };
}

async function reset() {
  const existing = await prisma.tenant.findUnique({ where: { slug: 'demo-studio' } });
  if (!existing) return;
  const t = existing.id;
  const pages = await prisma.linkInBioPage.findMany({ where: { tenantId: t }, select: { id: true } });
  await prisma.linkItem.deleteMany({ where: { pageId: { in: pages.map((p) => p.id) } } });
  await prisma.analyticsSnapshot.deleteMany({ where: { tenantId: t } });
  await prisma.publication.deleteMany({ where: { tenantId: t } });
  await prisma.publishJob.deleteMany({ where: { tenantId: t } });
  await prisma.postActivity.deleteMany({ where: { post: { tenantId: t } } });
  await prisma.post.deleteMany({ where: { tenantId: t } });
  // Asset has a self-relation (versions → parent); delete children first.
  await prisma.asset.deleteMany({ where: { tenantId: t, parentAssetId: { not: null } } });
  await prisma.asset.deleteMany({ where: { tenantId: t } });
  await prisma.creativeBrief.deleteMany({ where: { tenantId: t } });
  await prisma.promptCache.deleteMany({ where: { tenantId: t } });
  await prisma.copyGeneration.deleteMany({ where: { tenantId: t } });
  await prisma.campaign.deleteMany({ where: { tenantId: t } });
  await prisma.product.deleteMany({ where: { tenantId: t } });
  await prisma.socialAccount.deleteMany({ where: { tenantId: t } });
  await prisma.qRCode.deleteMany({ where: { tenantId: t } });
  await prisma.videoProject.deleteMany({ where: { tenantId: t } });
  await prisma.notification.deleteMany({ where: { tenantId: t } });
  await prisma.linkInBioPage.deleteMany({ where: { tenantId: t } });
  await prisma.brandKit.deleteMany({ where: { brand: { tenantId: t } } });
  await prisma.brandProfile.deleteMany({ where: { tenantId: t } });
  await prisma.user.deleteMany({ where: { tenantId: t } });
  await prisma.tenant.delete({ where: { id: t } });
  console.log('   cleared the previous demo tenant');
}

async function main() {
  console.log('🌱 Seeding demo data...');
  await reset();

  // --- Workspace & team ----------------------------------------------------
  const passwordHash = await bcrypt.hash('password123', 10);
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Demo Studio',
      slug: 'demo-studio',
      plan: 'pro',
      users: {
        create: [
          { name: 'Aisha Rahman', email: 'owner@demo.com', passwordHash, role: 'OWNER' },
          { name: 'Rohan Ahmed', email: 'creator@demo.com', passwordHash, role: 'CREATOR' },
          { name: 'Nusrat Jahan', email: 'designer@demo.com', passwordHash, role: 'CREATOR' },
        ],
      },
    },
    include: { users: true },
  });
  const owner = tenant.users.find((u) => u.email === 'owner@demo.com');
  const rohan = tenant.users.find((u) => u.email === 'creator@demo.com');
  const nusrat = tenant.users.find((u) => u.email === 'designer@demo.com');
  const T = tenant.id;

  // --- Brands --------------------------------------------------------------
  const nokshi = await prisma.brandProfile.create({
    data: {
      tenantId: T,
      name: 'Nokshi Threads',
      slug: 'nokshi-threads',
      tagline: 'Handwoven heritage, reimagined.',
      description:
        'A Dhaka-based fashion label working directly with handloom weavers in Narayanganj and Tangail — jamdani, nakshi kantha and khadi, cut for how people actually dress today.',
      industry: 'Fashion & Apparel',
      website: 'https://nokshithreads.example',
      email: 'hello@nokshithreads.example',
      phone: '+8801711000001',
      address: 'House 42, Road 11, Dhanmondi, Dhaka 1209',
      logoUrl: img('minimal elegant monogram logo for a bangladeshi handloom fashion label, jamdani motif, deep red on ivory', 101, 400, 400),
      socialLinks: {
        facebook: 'https://facebook.com/nokshithreads',
        instagram: 'https://instagram.com/nokshithreads',
      },
    },
  });

  const chaAdda = await prisma.brandProfile.create({
    data: {
      tenantId: T,
      name: 'Cha Adda',
      slug: 'cha-adda',
      tagline: 'Where every cup starts a conversation.',
      description:
        'A neighbourhood tea café in Banani serving malai cha, masala cha and home-style shingara. Built for long adda, slow evenings and student budgets.',
      industry: 'Food & Beverage',
      website: 'https://chaadda.example',
      email: 'adda@chaadda.example',
      phone: '+8801711000002',
      address: 'Road 17, Banani, Dhaka 1213',
      logoUrl: img('cozy tea cafe logo, warm terracotta and cream, steaming clay cup illustration, bengali character', 102, 400, 400),
      socialLinks: { facebook: 'https://facebook.com/chaadda', instagram: 'https://instagram.com/chaadda' },
    },
  });

  await prisma.brandKit.createMany({
    data: [
      {
        brandId: nokshi.id,
        locked: true,
        primaryColor: '#9D2235',
        palette: [
          { hex: '#9D2235', name: 'Alta Red', role: 'primary' },
          { hex: '#1D3557', name: 'Indigo', role: 'secondary' },
          { hex: '#E9C46A', name: 'Zari Gold', role: 'accent' },
          { hex: '#F1FAEE', name: 'Ivory', role: 'light' },
          { hex: '#222222', name: 'Ink', role: 'dark' },
        ],
        fonts: { heading: 'Playfair Display', body: 'Inter' },
        logoUrl: nokshi.logoUrl,
      },
      {
        brandId: chaAdda.id,
        locked: false,
        primaryColor: '#B45309',
        palette: [
          { hex: '#B45309', name: 'Terracotta', role: 'primary' },
          { hex: '#3F2A1D', name: 'Roast', role: 'secondary' },
          { hex: '#F4A261', name: 'Malai', role: 'accent' },
          { hex: '#FDF6EC', name: 'Cream', role: 'light' },
          { hex: '#1C1917', name: 'Charcoal', role: 'dark' },
        ],
        fonts: { heading: 'Fraunces', body: 'Inter' },
        logoUrl: chaAdda.logoUrl,
      },
    ],
  });

  // --- Products ------------------------------------------------------------
  const productSpecs = [
    [nokshi.id, 'Jamdani Handloom Saree', 'NT-SAR-001', 8500, 'Saree', 'handwoven jamdani saree draped on a mannequin, intricate white motifs on alta red, studio product photo', 201, ['saree', 'jamdani', 'handloom']],
    [nokshi.id, 'Cotton Panjabi — Eid Edition', 'NT-PAN-002', 2200, 'Panjabi', 'elegant ivory cotton panjabi for men with subtle gold embroidery, festive, studio product photo', 202, ['panjabi', 'eid', 'menswear']],
    [nokshi.id, 'Nakshi Kantha Kurti', 'NT-KUR-003', 1800, 'Kurti', 'nakshi kantha embroidered kurti in indigo, colourful running stitch, studio product photo', 203, ['kurti', 'kantha', 'womenswear']],
    [nokshi.id, 'Handloom Silk Dupatta', 'NT-DUP-004', 1200, 'Accessories', 'handloom silk dupatta with zari gold border, draped, studio product photo', 204, ['dupatta', 'silk', 'accessories']],
    [nokshi.id, 'Khadi Shirt', 'NT-SHT-005', 1950, 'Shirt', 'natural khadi cotton shirt, minimal, folded flatlay, studio product photo', 205, ['khadi', 'shirt', 'menswear']],
    [nokshi.id, 'Winter Shawl', 'NT-SHW-006', 3400, 'Shawl', 'thick handwoven winter shawl in deep indigo with woven border, studio product photo', 206, ['shawl', 'winter']],
    [chaAdda.id, 'Malai Cha (Regular)', 'CA-CHA-001', 60, 'Beverage', 'creamy malai cha in a small clay cup, steam rising, warm cafe light, food photography', 211, ['cha', 'signature']],
    [chaAdda.id, 'Masala Cha', 'CA-CHA-002', 70, 'Beverage', 'spiced masala cha in a glass with cinnamon and cardamom beside it, food photography', 212, ['cha', 'spiced']],
    [chaAdda.id, 'Homemade Shingara (4 pcs)', 'CA-SNK-003', 80, 'Snack', 'four golden crisp shingara on a steel plate with tamarind chutney, bangladeshi street food photography', 213, ['snack', 'savoury']],
    [chaAdda.id, 'Adda Combo — Cha + Shingara', 'CA-CMB-004', 130, 'Combo', 'clay cup of cha with a plate of shingara on a wooden cafe table, cozy, food photography', 214, ['combo', 'value']],
  ];
  const products = [];
  for (const [brandId, name, sku, price, category, prompt, seed, tags] of productSpecs) {
    products.push(
      await prisma.product.create({
        data: {
          tenantId: T,
          brandId,
          name,
          sku,
          price,
          currency: 'BDT',
          category,
          description: `${name} — made in small batches, priced for everyday.`,
          images: [img(prompt, seed)],
          tags,
        },
      })
    );
  }

  // --- Campaigns -----------------------------------------------------------
  const eid = await prisma.campaign.create({
    data: {
      tenantId: T, brandId: nokshi.id, name: 'Eid Collection 2026', theme: 'premium',
      description: 'Premium festive apparel for the Eid shopping season — panjabi, saree and gifting sets.',
      color: '#2A9D8F', startDate: daysAgo(21), endDate: daysAhead(18),
    },
  });
  const boishakh = await prisma.campaign.create({
    data: {
      tenantId: T, brandId: nokshi.id, name: 'Pohela Boishakh Campaign', theme: 'festive',
      description: 'Red-and-white Bengali New Year collection, alpona motifs and mela-day offers.',
      color: '#E63946', isSuggested: true, momentKey: 'pohela-boishakh', startDate: daysAhead(34),
    },
  });
  const heritage = await prisma.campaign.create({
    data: {
      tenantId: T, brandId: nokshi.id, name: 'Made By Hand', theme: 'storytelling',
      description: 'Evergreen weaver stories — the people and the process behind each piece.',
      color: '#1D3557', startDate: daysAgo(56),
    },
  });
  const monsoon = await prisma.campaign.create({
    data: {
      tenantId: T, brandId: chaAdda.id, name: 'Monsoon Adda Hours', theme: 'seasonal',
      description: 'Rainy-evening combos and long-table adda offers, 4pm till late.',
      color: '#B45309', startDate: daysAgo(35), endDate: daysAhead(10),
    },
  });

  // --- Connected channels (mock tokens → publishing + insights run offline) --
  await prisma.socialAccount.createMany({
    data: [
      { tenantId: T, brandId: nokshi.id, platform: 'FACEBOOK', externalId: 'mock.page.nokshi', pageId: 'mock.page.nokshi', name: 'Nokshi Threads', accessToken: encrypt('mock.page.token'), igBusinessId: 'mock.ig.nokshi' },
      { tenantId: T, brandId: nokshi.id, platform: 'INSTAGRAM', externalId: 'mock.ig.nokshi', pageId: 'mock.page.nokshi', name: 'Nokshi Threads (Instagram)', accessToken: encrypt('mock.page.token'), igBusinessId: 'mock.ig.nokshi' },
      { tenantId: T, brandId: chaAdda.id, platform: 'FACEBOOK', externalId: 'mock.page.chaadda', pageId: 'mock.page.chaadda', name: 'Cha Adda', accessToken: encrypt('mock.page.token'), igBusinessId: 'mock.ig.chaadda' },
      { tenantId: T, brandId: chaAdda.id, platform: 'INSTAGRAM', externalId: 'mock.ig.chaadda', pageId: 'mock.page.chaadda', name: 'Cha Adda (Instagram)', accessToken: encrypt('mock.page.token'), igBusinessId: 'mock.ig.chaadda' },
    ],
  });
  const accounts = await prisma.socialAccount.findMany({ where: { tenantId: T } });
  const accountFor = (brandId, platform) => accounts.find((a) => a.brandId === brandId && a.platform === platform);

  /* -------------------------------------------------------------------------
   * Published history.
   *
   * Each row is: [brand, campaign, title, body, hashtags, imagePrompt, seed,
   *               platforms, publishedAt, impressions, engagementRate].
   * Friday and Saturday evenings carry the strongest numbers, Monday mornings
   * the weakest — that pattern is what the best-time-to-post charts surface.
   * ---------------------------------------------------------------------- */
  const FRI = 5; const SAT = 6; const SUN = 0; const MON = 1; const TUE = 2; const WED = 3; const THU = 4;

  const published = [
    [nokshi, eid, 'Three weeks on the loom',
      'Every Jamdani saree we sell takes two weavers about three weeks — no shortcuts, no power looms.\n\nThe alta-red piece is back in stock this morning. 34 available.',
      ['Jamdani', 'Handloom', 'NokshiThreads'], 'handwoven jamdani saree close up, white motifs on alta red, natural window light, editorial fashion photography', 301,
      ['INSTAGRAM'], on(FRI, 20, 0), 24800, 8.4],
    [nokshi, eid, 'The Eid panjabi drop is live',
      'Ivory khadi, hand-finished collar, gold thread at the placket. Sizes 38–46.\n\nFree delivery inside Dhaka until Eid. Link in bio 👉',
      ['EidCollection', 'Panjabi', 'Menswear'], 'ivory cotton panjabi with subtle gold embroidery on a hanger, festive eid styling, editorial product photography', 302,
      ['FACEBOOK', 'INSTAGRAM'], on(FRI, 20, 1), 31200, 9.1],
    [nokshi, eid, 'Alta red, zari gold',
      'Our two most-requested colours, finally in one piece. Swipe for the border detail.',
      ['Saree', 'ZariBorder', 'Eid'], 'detail shot of a red saree with intricate gold zari border, macro textile photography, warm light', 303,
      ['INSTAGRAM'], on(SAT, 21, 0), 18600, 7.6],
    [nokshi, heritage, 'Behind the loom: meet Rahima',
      'Rahima apa has been weaving in Tangail for 22 years. She trained four of the six weavers we work with.\n\nThis is who your money reaches.',
      ['MadeByHand', 'Handloom', 'Tangail'], 'portrait of a bangladeshi woman weaver at a wooden handloom, documentary photography, natural light', 304,
      ['FACEBOOK'], on(THU, 19, 1), 12400, 6.2],
    [nokshi, null, 'Nakshi kantha kurti — restocked',
      'You asked, we listened. Indigo and off-white, both back in all sizes.',
      ['Kurti', 'NakshiKantha'], 'indigo nakshi kantha embroidered kurti flatlay on cream linen, product photography', 305,
      ['INSTAGRAM'], on(TUE, 13, 0), 9800, 4.8],
    [nokshi, null, 'One saree, three ways',
      'Classic drape, belted, or over trousers. Same six yards.\n\nWhich one are you wearing this weekend?',
      ['StylingTips', 'Saree'], 'three styling variations of a handloom saree on one model, fashion editorial triptych', 306,
      ['INSTAGRAM'], on(SAT, 21, 2), 21400, 8.0],
    [nokshi, eid, 'Free delivery inside Dhaka',
      'Order before the 20th and delivery inside Dhaka is on us. Outside Dhaka, flat ৳80.',
      ['Offer', 'Dhaka'], 'minimal typographic announcement graphic, alta red and ivory, delivery scooter illustration', 307,
      ['FACEBOOK'], on(MON, 9, 1), 6200, 2.9],
    [nokshi, null, 'Silk dupatta, six colourways',
      'Handloom silk with a zari edge. Light enough for summer, formal enough for a wedding.',
      ['Dupatta', 'Silk'], 'six handloom silk dupattas in different colours arranged in a fan, flatlay product photography', 308,
      ['INSTAGRAM'], on(SUN, 18, 2), 14100, 6.5],
    [nokshi, eid, "Farhana's Eid, in her words",
      '"I wore it to two dawats and my mother asked where I got it. That never happens."\n\nThank you Farhana 🤍',
      ['CustomerStory', 'Eid'], 'happy bangladeshi woman in an elegant handloom saree at a family gathering, candid photography', 309,
      ['FACEBOOK', 'INSTAGRAM'], on(FRI, 20, 3), 27300, 8.8],
    [nokshi, null, 'The gold border, up close',
      'Zari is woven in, not printed on. That is the whole difference.',
      ['Zari', 'Craft'], 'extreme macro of gold zari thread woven into red silk, textile detail photography', 310,
      ['INSTAGRAM'], on(WED, 15, 3), 11200, 5.4],
    [nokshi, heritage, 'Winter shawls are here',
      'Thick handwoven wool-cotton blend, natural indigo dye. Two colourways, limited to 60 pieces.',
      ['Winter', 'Shawl'], 'deep indigo handwoven winter shawl folded on weathered wood, moody product photography', 311,
      ['INSTAGRAM'], on(SAT, 21, 5), 16800, 7.1],
    [nokshi, null, 'Gift wrapping, on the house',
      'Every order this month ships in our reusable kantha-stitch pouch. No extra charge.',
      ['Gifting', 'Packaging'], 'handmade kantha stitch fabric gift pouch with a ribbon on a cream surface, product photography', 312,
      ['FACEBOOK'], on(TUE, 13, 4), 7400, 3.6],
    [nokshi, heritage, 'Handloom is slow fashion',
      'Six weavers. Forty pieces a month. That is the whole operation, and we like it that way.',
      ['SlowFashion', 'MadeByHand'], 'wide shot of a small bangladeshi handloom workshop with wooden looms and hanging thread, documentary', 313,
      ['INSTAGRAM'], on(THU, 19, 5), 13500, 6.0],
    [nokshi, boishakh, 'Boishakh preview: red & white',
      'The Noboborsho collection lands next month. Here is the first look.',
      ['PohelaBoishakh', 'Noboborsho'], 'red and white bengali new year fashion styling with alpona patterns, festive editorial photography', 314,
      ['FACEBOOK'], on(MON, 9, 6), 5900, 2.7],

    [chaAdda, monsoon, 'Malai cha season is here',
      'Thick, slow-boiled, barely sweet. ৳60 a cup, all day.\n\nBanani, Road 17. Come sit.',
      ['MalaiCha', 'Banani', 'Dhaka'], 'creamy malai cha in a clay cup with steam, warm cafe interior bokeh, food photography', 401,
      ['FACEBOOK', 'INSTAGRAM'], on(FRI, 20, 0), 8900, 7.8],
    [chaAdda, monsoon, 'Adda hours: 4pm till late',
      'No time limit on the table. Bring your friends, bring your laptop, bring the argument you have been saving.',
      ['Adda', 'ChaAdda'], 'group of friends laughing around a small table with tea cups in a cozy dhaka cafe at night, candid', 402,
      ['INSTAGRAM'], on(SAT, 21, 1), 6400, 6.9],
    [chaAdda, null, 'New: cardamom lemon cha',
      'Lighter than masala, sharper than doodh cha. On the menu from today, ৳70.',
      ['NewOnMenu', 'Cha'], 'clear glass of golden lemon cardamom tea with lemon slices and cardamom pods, food photography', 403,
      ['INSTAGRAM'], on(SUN, 18, 2), 5100, 5.5],
    [chaAdda, monsoon, 'Monsoon combo: cha + shingara',
      'Two shingara and a malai cha for ৳130. Rain optional but recommended.',
      ['Combo', 'Shingara'], 'clay cup of tea beside a plate of crisp shingara on a wooden table by a rainy window, food photography', 404,
      ['FACEBOOK'], on(TUE, 13, 3), 3200, 3.1],
    [chaAdda, null, 'Meet the chaiwala',
      'Sumon bhai has made roughly 400 cups a day for the last two years. He knows your order.',
      ['TeamStory', 'ChaAdda'], 'bangladeshi tea maker pouring cha from height into a cup, motion, warm cafe light, documentary', 405,
      ['INSTAGRAM'], on(THU, 19, 4), 4400, 5.9],
  ];

  const activityRows = [];
  const publishJobRows = [];

  for (const [brand, campaign, title, body, hashtags, prompt, seed, platforms, publishedAt, impressions, rate] of published) {
    const author = seed % 2 === 0 ? rohan : nusrat;
    const post = await prisma.post.create({
      data: {
        tenantId: T, brandId: brand.id, authorId: author.id, reviewerId: owner.id,
        campaignId: campaign?.id ?? null,
        title, body, hashtags, platforms,
        mediaUrls: [img(prompt, seed)],
        status: 'PUBLISHED', publishedAt, scheduledAt: publishedAt,
      },
    });

    const submitted = new Date(publishedAt.getTime() - 2 * 86400_000);
    const approved = new Date(publishedAt.getTime() - 86400_000);
    activityRows.push(
      { postId: post.id, actorId: author.id, action: 'SUBMIT', fromState: 'DRAFT', toState: 'PENDING_REVIEW', createdAt: submitted },
      { postId: post.id, actorId: owner.id, action: 'APPROVE', fromState: 'PENDING_REVIEW', toState: 'APPROVED', createdAt: approved },
      { postId: post.id, actorId: owner.id, action: 'SCHEDULE', fromState: 'APPROVED', toState: 'SCHEDULED', createdAt: approved },
      { postId: post.id, actorId: owner.id, action: 'PUBLISH', fromState: 'SCHEDULED', toState: 'PUBLISHING', createdAt: publishedAt }
    );
    publishJobRows.push({
      tenantId: T, postId: post.id, status: 'SUCCESS', attempts: 1, runAt: publishedAt,
      createdAt: approved, updatedAt: publishedAt,
    });

    // Instagram carries a little more reach than Facebook for these brands.
    for (const platform of platforms) {
      const share = platforms.length === 1 ? 1 : platform === 'INSTAGRAM' ? 0.62 : 0.38;
      const account = accountFor(brand.id, platform);
      const pub = await prisma.publication.create({
        data: {
          tenantId: T, postId: post.id, platform, socialAccountId: account?.id,
          status: 'SUCCESS',
          externalId: `mock_${platform.toLowerCase()}_${seed}`,
          permalink: platform === 'INSTAGRAM' ? `https://instagram.com/p/mock_${seed}` : `https://facebook.com/${brand.slug}/posts/${seed}`,
          publishedAt, createdAt: publishedAt, updatedAt: publishedAt,
        },
      });
      await prisma.analyticsSnapshot.create({
        data: {
          tenantId: T, publicationId: pub.id,
          ...metrics(Math.round(impressions * share), rate),
          capturedAt: new Date(Math.min(Date.now(), publishedAt.getTime() + 2 * 86400_000)),
        },
      });
    }
  }

  /* -------------------------------------------------------------------------
   * Work in flight — one post sitting in every other state so the calendar,
   * approvals board and publishing queue all have something to show.
   * ---------------------------------------------------------------------- */
  const pendingA = await prisma.post.create({
    data: {
      tenantId: T, brandId: nokshi.id, authorId: rohan.id, campaignId: eid.id,
      title: 'Eid gifting sets — final call',
      body: 'Three sets left: the panjabi + pocket square, the saree + dupatta, and the kantha pouch bundle.\n\nOrders close Thursday for delivery before Eid.',
      hashtags: ['EidGifting', 'LastCall'], platforms: ['FACEBOOK', 'INSTAGRAM'],
      mediaUrls: [img('elegant eid gift set flatlay with folded panjabi, pocket square and kantha pouch, ivory and gold, product photography', 320)],
      status: 'PENDING_REVIEW', scheduledAt: daysAhead(3),
    },
  });
  const pendingB = await prisma.post.create({
    data: {
      tenantId: T, brandId: chaAdda.id, authorId: nusrat.id, campaignId: monsoon.id,
      title: 'Student hours: 20% off till 6pm',
      body: 'Show a student ID, get 20% off everything until 6pm on weekdays. Yes, including the combo.',
      hashtags: ['StudentOffer', 'Banani'], platforms: ['INSTAGRAM'],
      mediaUrls: [img('students studying with tea cups at a cozy dhaka cafe table, afternoon light, candid photography', 421)],
      status: 'PENDING_REVIEW', scheduledAt: daysAhead(2),
    },
  });
  activityRows.push(
    { postId: pendingA.id, actorId: rohan.id, action: 'SUBMIT', fromState: 'DRAFT', toState: 'PENDING_REVIEW', createdAt: daysAgo(1, 16) },
    { postId: pendingB.id, actorId: nusrat.id, action: 'SUBMIT', fromState: 'DRAFT', toState: 'PENDING_REVIEW', createdAt: daysAgo(0, 11) }
  );

  const approved = await prisma.post.create({
    data: {
      tenantId: T, brandId: nokshi.id, authorId: nusrat.id, reviewerId: owner.id, campaignId: boishakh.id,
      title: 'Noboborsho collection — first look',
      body: 'Red, white, and one very stubborn shade of alta. Full collection drops on the 14th.',
      hashtags: ['PohelaBoishakh', 'Noboborsho', 'RedAndWhite'], platforms: ['FACEBOOK', 'INSTAGRAM'],
      mediaUrls: [img('red and white bengali new year collection lookbook cover, alpona motif, festive editorial photography', 321)],
      status: 'APPROVED', reviewNote: 'Lovely. Hold it for the 14th.',
    },
  });
  activityRows.push(
    { postId: approved.id, actorId: nusrat.id, action: 'SUBMIT', fromState: 'DRAFT', toState: 'PENDING_REVIEW', createdAt: daysAgo(3, 14) },
    { postId: approved.id, actorId: owner.id, action: 'APPROVE', fromState: 'PENDING_REVIEW', toState: 'APPROVED', createdAt: daysAgo(2, 10) }
  );

  const scheduledSpecs = [
    [nokshi, eid, 'Last 48 hours of the Eid drop',
      'Panjabi sizes 40 and 42 are almost gone. Sarees are holding steady.\n\nAfter Thursday, next restock is post-Eid.',
      ['EidCollection', 'LastChance'], 'ivory panjabi and red saree side by side on a rail, warm boutique lighting, product photography', 322,
      ['FACEBOOK', 'INSTAGRAM'], daysAhead(2, 20)],
    [nokshi, heritage, 'How a jamdani motif is planned',
      'No pattern sheet, no software. The design lives in the weaver\'s head and gets counted thread by thread.',
      ['MadeByHand', 'Jamdani'], 'weaver hands counting threads on a jamdani loom, close up documentary photography, natural light', 323,
      ['INSTAGRAM'], daysAhead(5, 20)],
    [chaAdda, monsoon, 'Rainy evening playlist + cha',
      'We made a two-hour playlist for exactly this weather. Ask at the counter, we will put it on.',
      ['Adda', 'Monsoon'], 'rain streaked cafe window with a warm cup of tea on the sill, moody evening photography', 422,
      ['INSTAGRAM'], daysAhead(4, 19)],
  ];
  for (const [brand, campaign, title, body, hashtags, prompt, seed, platforms, when] of scheduledSpecs) {
    const post = await prisma.post.create({
      data: {
        tenantId: T, brandId: brand.id, authorId: rohan.id, reviewerId: owner.id, campaignId: campaign?.id ?? null,
        title, body, hashtags, platforms, mediaUrls: [img(prompt, seed)],
        status: 'SCHEDULED', scheduledAt: when,
      },
    });
    activityRows.push(
      { postId: post.id, actorId: rohan.id, action: 'SUBMIT', fromState: 'DRAFT', toState: 'PENDING_REVIEW', createdAt: daysAgo(4, 15) },
      { postId: post.id, actorId: owner.id, action: 'APPROVE', fromState: 'PENDING_REVIEW', toState: 'APPROVED', createdAt: daysAgo(3, 11) },
      { postId: post.id, actorId: owner.id, action: 'SCHEDULE', fromState: 'APPROVED', toState: 'SCHEDULED', createdAt: daysAgo(3, 11) }
    );
    publishJobRows.push({ tenantId: T, postId: post.id, status: 'QUEUED', attempts: 0, runAt: when, createdAt: daysAgo(3, 11) });
  }

  const rejected = await prisma.post.create({
    data: {
      tenantId: T, brandId: nokshi.id, authorId: rohan.id, reviewerId: owner.id,
      title: 'FLASH SALE 70% OFF EVERYTHING',
      body: 'HUGE DISCOUNT!!! 70% OFF!!! TODAY ONLY!!! DM FAST!!!',
      hashtags: ['Sale', 'Discount'], platforms: ['FACEBOOK'],
      status: 'REJECTED',
      rejectReason: 'Too aggressive for where we sit. We have never discounted past 20% and the all-caps reads like a different brand — rewrite it as a quiet end-of-season note.',
    },
  });
  activityRows.push(
    { postId: rejected.id, actorId: rohan.id, action: 'SUBMIT', fromState: 'DRAFT', toState: 'PENDING_REVIEW', createdAt: daysAgo(6, 17) },
    { postId: rejected.id, actorId: owner.id, action: 'REJECT', fromState: 'PENDING_REVIEW', toState: 'REJECTED', note: 'Discount too aggressive', createdAt: daysAgo(6, 18) }
  );

  // A permanent failure, so the publishing board has a retryable row.
  const failed = await prisma.post.create({
    data: {
      tenantId: T, brandId: chaAdda.id, authorId: nusrat.id, reviewerId: owner.id, campaignId: monsoon.id,
      title: 'Weekend live: cha brewing demo',
      body: 'Sumon bhai is doing a 20-minute brewing demo on Saturday at 5pm. Free, but the seats go fast.',
      hashtags: ['Live', 'ChaAdda'], platforms: ['FACEBOOK', 'INSTAGRAM'],
      mediaUrls: [img('tea brewing demonstration on a cafe counter with an audience watching, warm light, event photography', 423)],
      status: 'FAILED', scheduledAt: daysAgo(2, 17),
    },
  });
  activityRows.push(
    { postId: failed.id, actorId: nusrat.id, action: 'SUBMIT', fromState: 'DRAFT', toState: 'PENDING_REVIEW', createdAt: daysAgo(4, 12) },
    { postId: failed.id, actorId: owner.id, action: 'APPROVE', fromState: 'PENDING_REVIEW', toState: 'APPROVED', createdAt: daysAgo(3, 9) },
    { postId: failed.id, actorId: owner.id, action: 'PUBLISH', fromState: 'SCHEDULED', toState: 'PUBLISHING', createdAt: daysAgo(2, 17) }
  );
  publishJobRows.push({
    tenantId: T, postId: failed.id, status: 'FAILED', attempts: 5, maxAttempts: 5,
    lastError: '(#10) Application does not have permission for this action',
    runAt: daysAgo(2, 17), createdAt: daysAgo(2, 17), updatedAt: daysAgo(2, 19),
  });
  await prisma.publication.create({
    data: {
      tenantId: T, postId: failed.id, platform: 'INSTAGRAM', socialAccountId: accountFor(chaAdda.id, 'INSTAGRAM')?.id,
      status: 'FAILED', error: '(#10) Application does not have permission for this action',
      createdAt: daysAgo(2, 17), updatedAt: daysAgo(2, 19),
    },
  });

  const draftSpecs = [
    [nokshi, 'Khadi shirts, restocked in three sizes', 'Natural, undyed khadi. Gets softer every wash. M, L and XL back in stock.', ['Khadi', 'Menswear'], 324],
    [nokshi, 'What "handloom" actually means', 'A note on why we keep saying it, and what it should mean when a label prints it.', ['MadeByHand'], 325],
    [chaAdda, 'We are hiring: weekend barista', 'Two shifts, Friday and Saturday evening. Cha training provided, attitude is not.', ['Hiring', 'Banani'], 424],
  ];
  for (const [brand, title, body, hashtags, seed] of draftSpecs) {
    const post = await prisma.post.create({
      data: {
        tenantId: T, brandId: brand.id, authorId: nusrat.id,
        title, body, hashtags, platforms: ['INSTAGRAM'],
        status: 'DRAFT',
      },
    });
    activityRows.push({ postId: post.id, actorId: nusrat.id, action: 'CREATE', toState: 'DRAFT', createdAt: daysAgo(seed % 5, 14) });
  }

  const archived = await prisma.post.create({
    data: {
      tenantId: T, brandId: nokshi.id, authorId: rohan.id, reviewerId: owner.id,
      title: 'Ramadan opening hours', body: 'Store hours during Ramadan: 10am–4pm, then 8pm–11pm.',
      hashtags: ['Ramadan'], platforms: ['FACEBOOK'], status: 'ARCHIVED',
    },
  });
  activityRows.push({ postId: archived.id, actorId: owner.id, action: 'ARCHIVE', fromState: 'PUBLISHED', toState: 'ARCHIVED', createdAt: daysAgo(9, 10) });

  await prisma.postActivity.createMany({ data: activityRows });
  await prisma.publishJob.createMany({ data: publishJobRows });

  // --- Creative briefs -----------------------------------------------------
  const briefEid = await prisma.creativeBrief.create({
    data: {
      tenantId: T, brandId: nokshi.id, authorId: rohan.id, productId: products[0].id,
      title: 'Eid saree hero shot', productRef: 'Jamdani Handloom Saree',
      style: 'luxury editorial', mood: 'festive', palette: 'alta red, zari gold, ivory',
      references: [img('luxury saree editorial reference, dramatic lighting', 501)],
      notes: 'Emphasise the gold border. Soft studio lighting, no harsh shadows on the weave.',
      status: 'COMPLETED',
      prompt: 'Jamdani Handloom Saree, luxury editorial style, festive mood, color palette: alta red, zari gold, ivory, for the brand "Nokshi Threads", professional product advertising photography, high detail, studio lighting, marketing creative',
      createdAt: daysAgo(12), updatedAt: daysAgo(11),
    },
  });
  const briefPanjabi = await prisma.creativeBrief.create({
    data: {
      tenantId: T, brandId: nokshi.id, authorId: nusrat.id, productId: products[1].id,
      title: 'Panjabi flatlay for the Eid drop', productRef: 'Cotton Panjabi — Eid Edition',
      style: 'minimalist', mood: 'premium', palette: 'ivory, gold, warm grey',
      references: [], notes: 'Flatlay on linen. Include the pocket square. Lots of negative space for copy.',
      status: 'COMPLETED',
      prompt: 'Cotton Panjabi — Eid Edition, minimalist style, premium mood, color palette: ivory, gold, warm grey, for the brand "Nokshi Threads", professional product advertising photography, high detail, studio lighting, marketing creative',
      createdAt: daysAgo(9), updatedAt: daysAgo(8),
    },
  });
  await prisma.creativeBrief.create({
    data: {
      tenantId: T, brandId: chaAdda.id, authorId: nusrat.id, productId: products[6].id,
      title: 'Malai cha hero for the menu board', productRef: 'Malai Cha (Regular)',
      style: 'lifestyle', mood: 'warm', palette: 'terracotta, cream, roast brown',
      references: [], notes: 'Steam has to read clearly. Shot from slightly above, clay cup only.',
      status: 'DRAFT', createdAt: daysAgo(4), updatedAt: daysAgo(4),
    },
  });
  await prisma.creativeBrief.create({
    data: {
      tenantId: T, brandId: nokshi.id, authorId: rohan.id,
      title: 'Winter shawl campaign (last season)', productRef: 'Winter Shawl',
      style: 'vintage', mood: 'calm', palette: 'indigo, oat, charcoal',
      references: [], notes: 'Archived — reuse the framing next winter.',
      status: 'ARCHIVED', createdAt: daysAgo(64), updatedAt: daysAgo(58),
    },
  });

  // --- Asset library -------------------------------------------------------
  const asset = (data) => prisma.asset.create({ data: { tenantId: T, ...data } });

  // A three-version chain: the saree hero shot, iterated twice.
  const sareeV1 = await asset({
    brandId: nokshi.id, briefId: briefEid.id, source: 'AI_GENERATED', type: 'IMAGE', version: 1,
    url: img('jamdani saree luxury editorial, alta red and zari gold, studio lighting, festive', 502),
    prompt: briefEid.prompt, tags: ['eid', 'saree', 'hero'], isFavorite: true, performance: 5,
    createdAt: daysAgo(12, 11),
  });
  await asset({
    brandId: nokshi.id, briefId: briefEid.id, source: 'AI_GENERATED', type: 'IMAGE', version: 2, parentAssetId: sareeV1.id,
    url: img('jamdani saree luxury editorial, alta red and zari gold, studio lighting, festive, tighter crop', 503),
    prompt: briefEid.prompt, tags: ['eid', 'saree', 'hero'], performance: 3, createdAt: daysAgo(12, 12),
  });
  await asset({
    brandId: nokshi.id, briefId: briefEid.id, source: 'AI_GENERATED', type: 'IMAGE', version: 3, parentAssetId: sareeV1.id,
    url: img('jamdani saree luxury editorial, alta red and zari gold, softer studio lighting, gold border emphasis', 504),
    prompt: briefEid.prompt, tags: ['eid', 'saree', 'hero', 'final'], isFavorite: true, performance: 8,
    createdAt: daysAgo(11, 10),
  });

  // A two-version chain for the panjabi flatlay.
  const panjabiV1 = await asset({
    brandId: nokshi.id, briefId: briefPanjabi.id, source: 'AI_GENERATED', type: 'IMAGE', version: 1,
    url: img('ivory panjabi flatlay on linen with pocket square, minimal, negative space, premium product photography', 505),
    prompt: briefPanjabi.prompt, tags: ['eid', 'panjabi', 'flatlay'], performance: 4, createdAt: daysAgo(9, 15),
  });
  await asset({
    brandId: nokshi.id, briefId: briefPanjabi.id, source: 'AI_GENERATED', type: 'IMAGE', version: 2, parentAssetId: panjabiV1.id,
    url: img('ivory panjabi flatlay on oat linen with pocket square and gold cufflinks, minimal, wide negative space', 506),
    prompt: briefPanjabi.prompt, tags: ['eid', 'panjabi', 'flatlay', 'final'], isFavorite: true, performance: 7,
    createdAt: daysAgo(8, 9),
  });

  const standaloneAssets = [
    [nokshi.id, 'AI_GENERATED', 'nakshi kantha texture macro, indigo running stitch on cream cotton', 507, ['texture', 'kantha'], true, 6],
    [nokshi.id, 'AI_GENERATED', 'red and white pohela boishakh styling with alpona motifs, festive editorial', 508, ['boishakh', 'festive'], false, 4],
    [nokshi.id, 'AI_GENERATED', 'handloom silk dupatta fan flatlay in six colours, product photography', 509, ['dupatta', 'colourway'], false, 2],
    [nokshi.id, 'AI_GENERATED', 'weaver at a wooden handloom in tangail, documentary portrait, natural light', 510, ['story', 'weaver'], true, 5],
    [nokshi.id, 'COMPOSITED', 'ivory panjabi cutout composited on a deep indigo gradient with festive typography', 511, ['composite', 'eid', 'ad'], false, 3],
    [nokshi.id, 'COMPOSITED', 'red saree cutout on a gold gradient background with new arrival badge', 512, ['composite', 'ad'], false, 2],
    [nokshi.id, 'UPLOAD', 'flat scan of a nakshi kantha embroidery swatch, archival reference', 513, ['reference', 'archive'], false, 0],
    [nokshi.id, 'UPLOAD', 'store front photograph of a small dhaka boutique at dusk', 514, ['store', 'brand'], false, 1],
    [chaAdda.id, 'AI_GENERATED', 'creamy malai cha in a clay cup with steam, warm cafe bokeh, food photography', 515, ['cha', 'hero'], true, 6],
    [chaAdda.id, 'AI_GENERATED', 'crisp shingara on a steel plate with tamarind chutney, street food photography', 516, ['snack', 'menu'], false, 3],
    [chaAdda.id, 'AI_GENERATED', 'rain streaked cafe window with a warm cup of tea, moody evening photography', 517, ['monsoon', 'mood'], false, 4],
    [chaAdda.id, 'UPLOAD', 'interior photograph of a cozy tea cafe with wooden tables and warm lamps', 518, ['interior', 'brand'], false, 1],
  ];
  for (const [brandId, source, prompt, seed, tags, isFavorite, performance] of standaloneAssets) {
    await asset({
      brandId, source, type: 'IMAGE', url: img(prompt, seed), prompt, tags, isFavorite, performance,
      createdAt: daysAgo(seed % 21, 13),
    });
  }

  // --- Prompt cache (Feature 7 — dedupe + high performers) ------------------
  await prisma.promptCache.createMany({
    data: [
      { tenantId: T, promptHash: 'seed-jamdani-editorial', prompt: 'jamdani saree luxury editorial, alta red and zari gold, studio lighting, festive', model: 'pollinations', params: { width: 1024, height: 1280, count: 2 }, resultUrls: [img('jamdani saree luxury editorial, alta red and zari gold, studio lighting, festive', 502), img('jamdani saree luxury editorial, alta red and zari gold, studio lighting, festive, tighter crop', 503)], hitCount: 11, performance: 8, lastUsedAt: daysAgo(1, 10) },
      { tenantId: T, promptHash: 'seed-panjabi-flatlay', prompt: 'ivory panjabi flatlay on linen with pocket square, minimal, negative space, premium product photography', model: 'pollinations', params: { width: 1024, height: 1024, count: 2 }, resultUrls: [img('ivory panjabi flatlay on linen with pocket square, minimal, negative space, premium product photography', 505)], hitCount: 7, performance: 7, lastUsedAt: daysAgo(3, 16) },
      { tenantId: T, promptHash: 'seed-kantha-macro', prompt: 'nakshi kantha texture macro, indigo running stitch on cream cotton', model: 'pollinations', params: { width: 1024, height: 1024, count: 2 }, resultUrls: [img('nakshi kantha texture macro, indigo running stitch on cream cotton', 507)], hitCount: 5, performance: 6, lastUsedAt: daysAgo(5, 12) },
      { tenantId: T, promptHash: 'seed-malai-cha', prompt: 'creamy malai cha in a clay cup with steam, warm cafe bokeh, food photography', model: 'pollinations', params: { width: 1024, height: 1024, count: 2 }, resultUrls: [img('creamy malai cha in a clay cup with steam, warm cafe bokeh, food photography', 515)], hitCount: 6, performance: 6, lastUsedAt: daysAgo(2, 15) },
      { tenantId: T, promptHash: 'seed-boishakh-styling', prompt: 'red and white pohela boishakh styling with alpona motifs, festive editorial', model: 'pollinations', params: { width: 1024, height: 1280, count: 2 }, resultUrls: [img('red and white pohela boishakh styling with alpona motifs, festive editorial', 508)], hitCount: 3, performance: 4, lastUsedAt: daysAgo(7, 11) },
      { tenantId: T, promptHash: 'seed-weaver-portrait', prompt: 'weaver at a wooden handloom in tangail, documentary portrait, natural light', model: 'pollinations', params: { width: 1024, height: 1024, count: 1 }, resultUrls: [img('weaver at a wooden handloom in tangail, documentary portrait, natural light', 510)], hitCount: 2, performance: 5, lastUsedAt: daysAgo(10, 14) },
    ],
  });

  // --- AI copy history -----------------------------------------------------
  await prisma.copyGeneration.createMany({
    data: [
      { tenantId: T, authorId: rohan.id, kind: 'caption', input: { product: 'Jamdani Saree', tone: 'elegant', platform: 'Instagram', brandName: 'Nokshi Threads' }, variations: ['Three weeks on the loom. A lifetime in your wardrobe. 🧵', 'Draped in tradition, woven for right now. Our Jamdani is back in stock.', 'Two weavers. Twenty-one days. One saree. Worth the wait.'], chosen: 'Three weeks on the loom. A lifetime in your wardrobe. 🧵', createdAt: daysAgo(1, 11) },
      { tenantId: T, authorId: nusrat.id, kind: 'ad_copy', input: { product: 'Eid Panjabi', tone: 'premium', platform: 'Facebook', brandName: 'Nokshi Threads' }, variations: ['Headline: The Eid panjabi, finally in ivory\n\nBody: Hand-finished collar, gold thread at the placket, khadi that breathes through a Dhaka summer. Sizes 38–46.\n\nCTA: Order before the 20th for free delivery inside Dhaka.'], chosen: null, createdAt: daysAgo(2, 15) },
      { tenantId: T, authorId: rohan.id, kind: 'hashtags', input: { product: 'Nakshi Kantha Kurti', tone: 'friendly', platform: 'Instagram' }, variations: ['#NakshiKantha #Handloom #Kurti #DhakaFashion #ShopLocal #MadeInBangladesh #SlowFashion #DeshiStyle'], chosen: null, createdAt: daysAgo(3, 10) },
      { tenantId: T, authorId: nusrat.id, kind: 'caption', input: { product: 'Malai Cha', tone: 'friendly', platform: 'Instagram', brandName: 'Cha Adda' }, variations: ['Thick, slow-boiled, barely sweet. ৳60 and a table for as long as you like. ☕', 'The cup that started the adda. Banani, Road 17.'], chosen: 'Thick, slow-boiled, barely sweet. ৳60 and a table for as long as you like. ☕', createdAt: daysAgo(4, 17) },
      { tenantId: T, authorId: rohan.id, kind: 'caption', input: { product: 'Winter Shawl', tone: 'calm', platform: 'Instagram', brandName: 'Nokshi Threads' }, variations: ['Natural indigo, handwoven, limited to 60. Winter has a uniform now.', 'Heavy enough for Dhaka in January. Soft enough to sleep in.'], chosen: null, createdAt: daysAgo(6, 12) },
      { tenantId: T, authorId: nusrat.id, kind: 'ad_copy', input: { product: 'Adda Combo', tone: 'playful', platform: 'Facebook', brandName: 'Cha Adda' }, variations: ['Headline: Two shingara and a cha, ৳130\n\nBody: The monsoon combo is back. Crisp, hot, and priced like it is still 2019.\n\nCTA: Banani Road 17, 4pm till late.'], chosen: null, createdAt: daysAgo(7, 16) },
      { tenantId: T, authorId: rohan.id, kind: 'hashtags', input: { product: 'Silk Dupatta', tone: 'elegant', platform: 'Instagram' }, variations: ['#SilkDupatta #ZariBorder #Handloom #NokshiThreads #DhakaStyle #WeddingSeason #DeshiFashion'], chosen: null, createdAt: daysAgo(9, 13) },
      { tenantId: T, authorId: nusrat.id, kind: 'caption', input: { product: 'Khadi Shirt', tone: 'bold', platform: 'Instagram', brandName: 'Nokshi Threads' }, variations: ['Undyed khadi. Gets better every wash. Back in M, L and XL.', 'The shirt that outlives the trend.'], chosen: null, createdAt: daysAgo(11, 9) },
    ],
  });

  // --- Link-in-bio ---------------------------------------------------------
  const nokshiPage = await prisma.linkInBioPage.create({
    data: {
      tenantId: T, brandId: nokshi.id, slug: 'nokshi-threads', title: 'Nokshi Threads',
      bio: 'Handwoven heritage, reimagined. Dhanmondi, Dhaka 🇧🇩', avatarUrl: nokshi.logoUrl,
      published: true, viewCount: 4820,
      theme: { bg: '#1D3557', accent: '#E9C46A', style: 'gradient' },
      links: {
        create: [
          { label: '🛍️ Shop the Eid Collection', url: 'https://nokshithreads.example/eid', order: 0, clicks: 1284 },
          { label: '🧵 How our jamdani is made', url: 'https://nokshithreads.example/craft', order: 1, clicks: 612 },
          { label: '📸 Instagram', url: 'https://instagram.com/nokshithreads', order: 2, clicks: 903 },
          { label: '💬 WhatsApp us', url: 'https://wa.me/8801711000001', order: 3, clicks: 741 },
          { label: '📍 Visit the Dhanmondi store', url: 'https://maps.google.com/?q=Dhanmondi+Dhaka', order: 4, clicks: 355 },
        ],
      },
    },
  });
  await prisma.linkInBioPage.create({
    data: {
      tenantId: T, brandId: chaAdda.id, slug: 'cha-adda', title: 'Cha Adda',
      bio: 'Malai cha, shingara and long adda. Banani Road 17, 4pm till late.', avatarUrl: chaAdda.logoUrl,
      published: false, viewCount: 0,
      theme: { bg: '#3F2A1D', accent: '#F4A261', style: 'gradient' },
      links: {
        create: [
          { label: '☕ See the menu', url: 'https://chaadda.example/menu', order: 0 },
          { label: '📍 Find us in Banani', url: 'https://maps.google.com/?q=Banani+Dhaka', order: 1 },
          { label: '💬 Book a long table', url: 'https://wa.me/8801711000002', order: 2 },
        ],
      },
    },
  });

  // --- QR codes ------------------------------------------------------------
  const qrSpecs = [
    [nokshi.id, eid.id, 'Eid catalogue — in-store standee', `${env.webBaseUrl}/l/${nokshiPage.slug}`, '#9D2235', '#ffffff', 1847],
    [nokshi.id, null, 'Hang tag — care instructions', 'https://nokshithreads.example/care', '#1D3557', '#ffffff', 623],
    [chaAdda.id, monsoon.id, 'Table card — menu', 'https://chaadda.example/menu', '#B45309', '#FDF6EC', 2140],
  ];
  for (const [brandId, campaignId, label, targetUrl, fgColor, bgColor, scanCount] of qrSpecs) {
    const code = await prisma.qRCode.create({
      data: { tenantId: T, brandId, campaignId, label, targetUrl, fgColor, bgColor, tracked: true, scanCount },
    });
    await prisma.qRCode.update({
      where: { id: code.id },
      data: {
        dataUrl: await QRCode.toDataURL(`${env.apiBaseUrl}/api/public/qr/${code.id}`, {
          errorCorrectionLevel: 'M', margin: 2, width: 512, color: { dark: fgColor, light: bgColor },
        }),
      },
    });
  }

  // --- Video projects ------------------------------------------------------
  await prisma.videoProject.createMany({
    data: [
      {
        tenantId: T, brandId: nokshi.id, title: 'Eid Collection Reel', aspect: '9:16', durationS: 12, status: 'DRAFT',
        images: [
          img('ivory panjabi on a hanger, festive eid styling, editorial product photography', 302, 1080, 1920),
          img('handwoven jamdani saree close up, white motifs on alta red, natural light', 301, 1080, 1920),
          img('elegant eid gift set flatlay with folded panjabi and kantha pouch, ivory and gold', 320, 1080, 1920),
        ],
        captions: ['This Eid,', 'wear heritage.', 'Nokshi Threads'],
        createdAt: daysAgo(5, 14),
      },
      {
        tenantId: T, brandId: nokshi.id, title: 'Made By Hand — square cut', aspect: '1:1', durationS: 10, status: 'DRAFT',
        images: [
          img('weaver hands counting threads on a jamdani loom, close up documentary', 323, 1080, 1080),
          img('wide shot of a small bangladeshi handloom workshop with wooden looms', 313, 1080, 1080),
          img('extreme macro of gold zari thread woven into red silk', 310, 1080, 1080),
        ],
        captions: ['Six weavers.', 'Forty pieces a month.', 'That is the whole operation.'],
        createdAt: daysAgo(8, 11),
      },
      {
        tenantId: T, brandId: chaAdda.id, title: 'Monsoon Adda — wide', aspect: '16:9', durationS: 8, status: 'DRAFT',
        images: [
          img('rain streaked cafe window with a warm cup of tea on the sill, moody evening', 422, 1920, 1080),
          img('creamy malai cha in a clay cup with steam, warm cafe interior bokeh', 401, 1920, 1080),
        ],
        captions: ['Rain outside.', 'Cha inside.'],
        createdAt: daysAgo(3, 18),
      },
    ],
  });

  // --- Notifications (a few unread so the bell carries a badge) ------------
  await prisma.notification.createMany({
    data: [
      { tenantId: T, userId: owner.id, type: 'APPROVAL_REQUEST', title: 'New post awaiting review', body: 'Eid gifting sets — final call', link: '/approvals', read: false, createdAt: daysAgo(1, 16) },
      { tenantId: T, userId: owner.id, type: 'APPROVAL_REQUEST', title: 'New post awaiting review', body: 'Student hours: 20% off till 6pm', link: '/approvals', read: false, createdAt: daysAgo(0, 11) },
      { tenantId: T, userId: owner.id, type: 'PUBLISH_FAILED', title: 'Publishing failed', body: 'Weekend live: cha brewing demo could not be published: (#10) Application does not have permission for this action', link: '/publishing', read: false, createdAt: daysAgo(2, 19) },
      { tenantId: T, userId: rohan.id, type: 'APPROVED', title: 'Your post was approved', body: 'Last 48 hours of the Eid drop', link: '/calendar', read: true, createdAt: daysAgo(3, 11) },
      { tenantId: T, userId: rohan.id, type: 'REJECTED', title: 'Your post needs changes', body: 'Discount too aggressive — align with brand positioning first.', link: '/approvals', read: true, createdAt: daysAgo(6, 18) },
      { tenantId: T, userId: nusrat.id, type: 'APPROVED', title: 'Your post was approved', body: 'Noboborsho collection — first look', link: '/calendar', read: true, createdAt: daysAgo(2, 10) },
      { tenantId: T, userId: nusrat.id, type: 'PUBLISHED', title: 'Your post is live 🎉', body: 'Malai cha season is here', link: '/publishing', read: true, createdAt: on(FRI, 20, 0) },
      { tenantId: T, userId: rohan.id, type: 'PUBLISHED', title: 'Your post is live 🎉', body: 'Three weeks on the loom', link: '/publishing', read: true, createdAt: on(FRI, 20, 0) },
      // The owner reviews everything, so their bell carries the deepest history.
      { tenantId: T, userId: owner.id, type: 'PUBLISHED', title: 'Post published', body: 'Three weeks on the loom went live on Instagram', link: '/publishing', read: true, createdAt: on(FRI, 20, 0) },
      { tenantId: T, userId: owner.id, type: 'PUBLISHED', title: 'Post published', body: 'Malai cha season is here went live on Facebook and Instagram', link: '/publishing', read: true, createdAt: on(FRI, 20, 0) },
      { tenantId: T, userId: owner.id, type: 'APPROVAL_REQUEST', title: 'New post awaiting review', body: 'Noboborsho collection — first look', link: '/approvals', read: true, createdAt: daysAgo(3, 14) },
      { tenantId: T, userId: owner.id, type: 'SYSTEM', title: 'Analytics refreshed', body: '23 publications synced from Meta', link: '/analytics', read: true, createdAt: daysAgo(1, 8) },
      { tenantId: T, userId: owner.id, type: 'PUBLISHED', title: 'Post published', body: "Farhana's Eid, in her words went live on Facebook and Instagram", link: '/publishing', read: true, createdAt: on(FRI, 20, 3) },
      { tenantId: T, userId: owner.id, type: 'APPROVAL_REQUEST', title: 'New post awaiting review', body: 'Last 48 hours of the Eid drop', link: '/approvals', read: true, createdAt: daysAgo(4, 15) },
    ],
  });

  // --- Summary -------------------------------------------------------------
  const counts = {
    posts: await prisma.post.count({ where: { tenantId: T } }),
    publications: await prisma.publication.count({ where: { tenantId: T } }),
    assets: await prisma.asset.count({ where: { tenantId: T } }),
    products: await prisma.product.count({ where: { tenantId: T } }),
  };
  console.log('✅ Seed complete.');
  console.log('   Sign in: owner@demo.com · creator@demo.com · designer@demo.com  (password123)');
  console.log('   Brands: Nokshi Threads, Cha Adda');
  console.log(`   ${counts.posts} posts across every state · ${counts.publications} publications with analytics`);
  console.log(`   ${counts.assets} assets (3 version chains) · ${counts.products} products · 4 campaigns · 3 reels`);
  console.log(`   Public link-in-bio: ${env.webBaseUrl}/l/${nokshiPage.slug}`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
