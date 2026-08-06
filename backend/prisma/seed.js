/* eslint-disable no-await-in-loop */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { encrypt } from '../src/lib/crypto.js';

const prisma = new PrismaClient();

const img = (prompt, seed, w = 1024, h = 1024) =>
  `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&seed=${seed}&nologo=true&model=flux`;

const daysAgo = (n) => new Date(Date.now() - n * 86400_000);
const daysAhead = (n) => new Date(Date.now() + n * 86400_000);
const rnd = (min, max) => Math.floor(min + Math.random() * (max - min));
const atHour = (date, hour) => {
  const d = new Date(date);
  d.setHours(hour, rnd(0, 59), 0, 0);
  return d;
};

async function main() {
  console.log('🌱 Seeding demo data...');

  // Reset: MongoDB uses emulated referential integrity, so delete children in
  // dependency order (users are referenced by posts/activities) before the tenant.
  const existing = await prisma.tenant.findUnique({ where: { slug: 'demo-studio' } });
  if (existing) {
    const t = existing.id;
    const pages = await prisma.linkInBioPage.findMany({ where: { tenantId: t }, select: { id: true } });
    await prisma.linkItem.deleteMany({ where: { pageId: { in: pages.map((p) => p.id) } } });
    await prisma.analyticsSnapshot.deleteMany({ where: { tenantId: t } });
    await prisma.publication.deleteMany({ where: { tenantId: t } });
    await prisma.publishJob.deleteMany({ where: { tenantId: t } });
    await prisma.postActivity.deleteMany({ where: { post: { tenantId: t } } });
    await prisma.post.deleteMany({ where: { tenantId: t } });
    // Asset has a self-relation (versions → parent); delete child versions first.
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
    console.log('   cleared previous demo tenant');
  }

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
        ],
      },
    },
    include: { users: true },
  });
  const owner = tenant.users.find((u) => u.role === 'OWNER');
  const creator = tenant.users.find((u) => u.role === 'CREATOR');
  console.log('   users: owner@demo.com / creator@demo.com  (password123)');

  // --- Brands -------------------------------------------------------------
  const nokshi = await prisma.brandProfile.create({
    data: {
      tenantId: tenant.id,
      name: 'Nokshi Threads',
      slug: 'nokshi-threads',
      tagline: 'Handwoven heritage, reimagined.',
      description: 'A Dhaka-based fashion label celebrating Bangladeshi handloom — jamdani, nakshi kantha & more.',
      industry: 'Fashion & Apparel',
      website: 'https://nokshithreads.example',
      email: 'hello@nokshithreads.example',
      phone: '+8801700000000',
      address: 'Dhanmondi, Dhaka',
      logoUrl: img('minimalist elegant logo for a bangladeshi handloom fashion brand, textile motif', 101, 400, 400),
      socialLinks: { facebook: 'https://facebook.com/nokshithreads', instagram: 'https://instagram.com/nokshithreads' },
    },
  });

  const chaAdda = await prisma.brandProfile.create({
    data: {
      tenantId: tenant.id,
      name: 'Cha Adda',
      slug: 'cha-adda',
      tagline: 'Where every cup starts a conversation.',
      description: 'A cozy neighbourhood tea café serving masala cha, malai cha and homemade snacks.',
      industry: 'Food & Beverage',
      logoUrl: img('cozy tea cafe logo, warm tones, teacup illustration, bengali', 102, 400, 400),
      socialLinks: { facebook: 'https://facebook.com/chaadda' },
    },
  });

  await prisma.brandKit.create({
    data: {
      brandId: nokshi.id,
      locked: true,
      primaryColor: '#9D2235',
      palette: [
        { hex: '#9D2235', name: 'Alta Red', role: 'primary' },
        { hex: '#1D3557', name: 'Indigo', role: 'secondary' },
        { hex: '#E9C46A', name: 'Gold', role: 'accent' },
        { hex: '#F1FAEE', name: 'Ivory', role: 'light' },
        { hex: '#222222', name: 'Ink', role: 'dark' },
      ],
      fonts: { heading: 'Playfair Display', body: 'Inter' },
      logoUrl: nokshi.logoUrl,
    },
  });

  // --- Products -----------------------------------------------------------
  const products = await Promise.all(
    [
      ['Jamdani Handloom Saree', 'SAR-001', 8500, 'Saree', 'handwoven jamdani saree, intricate motifs, studio product photo', 201],
      ['Cotton Panjabi', 'PAN-002', 2200, 'Panjabi', 'elegant cotton panjabi for men, festive, product photo', 202],
      ['Nakshi Kantha Kurti', 'KUR-003', 1800, 'Kurti', 'nakshi kantha embroidered kurti, colorful, product photo', 203],
      ['Silk Dupatta', 'DUP-004', 1200, 'Accessories', 'handloom silk dupatta, gold border, product photo', 204],
    ].map(([name, sku, price, category, prompt, seed]) =>
      prisma.product.create({
        data: {
          tenantId: tenant.id,
          brandId: nokshi.id,
          name,
          sku,
          price,
          currency: 'BDT',
          category,
          description: `${name} — crafted by local artisans.`,
          images: [img(prompt, seed)],
          tags: [category.toLowerCase(), 'handloom', 'deshi'],
        },
      })
    )
  );

  // --- Campaigns ----------------------------------------------------------
  const eidCampaign = await prisma.campaign.create({
    data: {
      tenantId: tenant.id,
      brandId: nokshi.id,
      name: 'Eid Collection 2026',
      theme: 'premium',
      description: 'Premium festive apparel for the Eid shopping season.',
      color: '#2A9D8F',
      startDate: daysAgo(5),
      endDate: daysAhead(20),
    },
  });
  const boishakhCampaign = await prisma.campaign.create({
    data: {
      tenantId: tenant.id,
      brandId: nokshi.id,
      name: 'Pohela Boishakh',
      theme: 'festive',
      description: 'Red-and-white Bengali New Year collection.',
      color: '#E63946',
      isSuggested: true,
      momentKey: 'pohela-boishakh',
    },
  });

  // --- Social accounts (mock, so publishing + analytics work) -------------
  await prisma.socialAccount.createMany({
    data: [
      {
        tenantId: tenant.id,
        brandId: nokshi.id,
        platform: 'FACEBOOK',
        externalId: 'mock.page.nokshi',
        pageId: 'mock.page.nokshi',
        name: 'Nokshi Threads',
        accessToken: encrypt('mock.page.token'),
        igBusinessId: 'mock.ig.nokshi',
      },
      {
        tenantId: tenant.id,
        brandId: nokshi.id,
        platform: 'INSTAGRAM',
        externalId: 'mock.ig.nokshi',
        pageId: 'mock.page.nokshi',
        name: 'Nokshi Threads (Instagram)',
        accessToken: encrypt('mock.page.token'),
        igBusinessId: 'mock.ig.nokshi',
      },
    ],
  });

  // --- Posts across every lifecycle state ---------------------------------
  const draft = await prisma.post.create({
    data: {
      tenantId: tenant.id, brandId: nokshi.id, authorId: creator.id, campaignId: eidCampaign.id,
      title: 'Eid teaser', body: 'Something special is coming this Eid ✨ Stay tuned for our premium panjabi drop.',
      hashtags: ['EidCollection', 'NokshiThreads', 'Panjabi'], platforms: ['FACEBOOK', 'INSTAGRAM'],
      mediaUrls: [img('elegant cotton panjabi festive eid, product photo', 202)], status: 'DRAFT',
    },
  });

  const pending = await prisma.post.create({
    data: {
      tenantId: tenant.id, brandId: nokshi.id, authorId: creator.id, campaignId: eidCampaign.id,
      title: 'Jamdani spotlight', body: 'Handwoven by master artisans over 3 weeks. Our signature Jamdani saree is back in stock 🧵',
      hashtags: ['Jamdani', 'Handloom', 'Saree'], platforms: ['INSTAGRAM'],
      mediaUrls: [img('handwoven jamdani saree, intricate motifs, studio product photo', 201)],
      status: 'PENDING_REVIEW',
    },
  });
  await prisma.postActivity.create({
    data: { postId: pending.id, actorId: creator.id, action: 'SUBMITTED', fromState: 'DRAFT', toState: 'PENDING_REVIEW' },
  });
  await prisma.notification.create({
    data: { tenantId: tenant.id, userId: owner.id, type: 'APPROVAL_REQUEST', title: 'New post awaiting review', body: 'Jamdani spotlight', link: '/approvals' },
  });

  const scheduled = await prisma.post.create({
    data: {
      tenantId: tenant.id, brandId: nokshi.id, authorId: creator.id, reviewerId: owner.id, campaignId: boishakhCampaign.id,
      title: 'Boishakh drop', body: 'Shubho Noboborsho! 🌸 Celebrate the Bengali New Year in red & white. New collection live now.',
      hashtags: ['PohelaBoishakh', 'Noboborsho', 'RedAndWhite'], platforms: ['FACEBOOK', 'INSTAGRAM'],
      mediaUrls: [img('red and white bengali new year fashion, festive, product photo', 205)],
      status: 'SCHEDULED', scheduledAt: daysAhead(2),
    },
  });

  await prisma.post.create({
    data: {
      tenantId: tenant.id, brandId: nokshi.id, authorId: creator.id, reviewerId: owner.id,
      title: 'Rejected draft', body: 'Flash sale 90% off everything!!!', platforms: ['FACEBOOK'],
      status: 'REJECTED', rejectReason: 'Discount too aggressive — align with brand positioning first.',
    },
  });

  // Published posts with publications + analytics snapshots (for the dashboard).
  const publishedSpecs = [
    ['Winter warmth', 'winter cozy shawl collection, warm tones', 3, 9],
    ['Kurti restock', 'nakshi kantha kurti colorful product photo', 7, 20],
    ['Weekend styling', 'bangladeshi fashion flatlay styling', 12, 13],
    ['Behind the loom', 'artisan weaving handloom, documentary', 18, 18],
    ['Gift guide', 'festive gift packaging fashion', 24, 11],
    ['Customer love', 'happy customer wearing saree testimonial', 29, 21],
  ];
  for (const [i, [title, prompt, ago, hour]] of publishedSpecs.entries()) {
    const publishedAt = atHour(daysAgo(ago), hour);
    const platform = i % 3 === 0 ? 'FACEBOOK' : 'INSTAGRAM';
    const post = await prisma.post.create({
      data: {
        tenantId: tenant.id, brandId: nokshi.id, authorId: creator.id, reviewerId: owner.id,
        campaignId: i % 2 === 0 ? eidCampaign.id : null,
        title, body: `${title} — shop the look now! Link in bio.`,
        hashtags: ['NokshiThreads', 'Handloom', 'Dhaka'], platforms: [platform],
        mediaUrls: [img(`${prompt}, product photo`, 300 + i)],
        status: 'PUBLISHED', publishedAt,
      },
    });
    await prisma.postActivity.create({
      data: { postId: post.id, actorId: owner.id, action: 'PUBLISHED', toState: 'PUBLISHED', createdAt: publishedAt },
    });
    const account = await prisma.socialAccount.findFirst({ where: { brandId: nokshi.id, platform } });
    const pub = await prisma.publication.create({
      data: {
        tenantId: tenant.id, postId: post.id, platform, socialAccountId: account?.id,
        status: 'SUCCESS', externalId: `mock_${platform}_${i}`, permalink: `https://example.com/p/${i}`, publishedAt,
      },
    });
    const impressions = rnd(1200, 12000);
    const likes = rnd(60, 900);
    const comments = rnd(3, 120);
    const shares = rnd(2, 160);
    const saves = rnd(1, 100);
    await prisma.analyticsSnapshot.create({
      data: {
        tenantId: tenant.id, publicationId: pub.id,
        impressions, reach: Math.round(impressions * 0.82), views: impressions,
        likes, comments, shares, saves, clicks: rnd(10, 400),
        engagement: Number((((likes + comments + shares + saves) / impressions) * 100).toFixed(2)),
        capturedAt: daysAgo(Math.max(0, ago - 1)),
      },
    });
  }

  // --- Creative briefs + versioned assets ---------------------------------
  const brief = await prisma.creativeBrief.create({
    data: {
      tenantId: tenant.id, brandId: nokshi.id, authorId: creator.id, productId: products[0].id,
      title: 'Eid saree hero shot', productRef: 'Jamdani Handloom Saree',
      style: 'luxury editorial', mood: 'festive', palette: 'alta red, gold, ivory',
      references: [img('luxury saree editorial reference', 401)],
      notes: 'Emphasise the gold border. Soft studio lighting.', status: 'COMPLETED',
      prompt: 'Jamdani Handloom Saree, luxury editorial style, festive mood, color palette: alta red, gold, ivory, studio lighting',
    },
  });

  const rootAsset = await prisma.asset.create({
    data: {
      tenantId: tenant.id, brandId: nokshi.id, briefId: brief.id, source: 'AI_GENERATED', type: 'IMAGE', version: 1,
      url: img('jamdani saree luxury editorial festive alta red gold ivory studio', 402),
      prompt: brief.prompt, tags: ['eid', 'saree', 'hero'], isFavorite: true, performance: 4,
    },
  });
  await prisma.asset.create({
    data: {
      tenantId: tenant.id, brandId: nokshi.id, briefId: brief.id, source: 'AI_GENERATED', type: 'IMAGE',
      version: 2, parentAssetId: rootAsset.id,
      url: img('jamdani saree luxury editorial festive alta red gold ivory studio', 403),
      prompt: brief.prompt, tags: ['eid', 'saree', 'hero'],
    },
  });
  for (const [i, [p, seed]] of [
    ['festive panjabi flatlay eid', 410],
    ['nakshi kantha texture closeup', 411],
    ['red white boishakh fashion', 412],
  ].entries()) {
    await prisma.asset.create({
      data: {
        tenantId: tenant.id, brandId: nokshi.id, source: 'AI_GENERATED', type: 'IMAGE',
        url: img(`${p}, product photo`, seed), prompt: p, tags: ['generated'], isFavorite: i === 0,
      },
    });
  }

  // --- Prompt cache entries -----------------------------------------------
  await prisma.promptCache.createMany({
    data: [
      { tenantId: tenant.id, promptHash: 'seed-hash-1', prompt: 'jamdani saree luxury editorial festive', model: 'pollinations', resultUrls: [img('jamdani editorial', 402)], hitCount: 7, performance: 4 },
      { tenantId: tenant.id, promptHash: 'seed-hash-2', prompt: 'festive panjabi flatlay eid', model: 'pollinations', resultUrls: [img('panjabi flatlay', 410)], hitCount: 3, performance: 2 },
    ],
  });

  // --- Copy generation history --------------------------------------------
  await prisma.copyGeneration.create({
    data: {
      tenantId: tenant.id, authorId: creator.id, kind: 'caption',
      input: { product: 'Jamdani Saree', tone: 'elegant', platform: 'Instagram' },
      variations: [
        'Draped in tradition, woven for today 🧵 Our Jamdani saree is back. #Handloom',
        'Three weeks on the loom. A lifetime of elegance. ✨ Shop now.',
      ],
    },
  });

  // --- Link-in-bio + QR ---------------------------------------------------
  const page = await prisma.linkInBioPage.create({
    data: {
      tenantId: tenant.id, brandId: nokshi.id, slug: 'nokshi-threads', title: 'Nokshi Threads',
      bio: 'Handwoven heritage, reimagined. Dhaka 🇧🇩', avatarUrl: nokshi.logoUrl, published: true,
      theme: { bg: '#1D3557', accent: '#E9C46A', style: 'gradient' },
      links: {
        create: [
          { label: '🛍️ Shop the Eid Collection', url: 'https://nokshithreads.example/eid', order: 0 },
          { label: '📸 Instagram', url: 'https://instagram.com/nokshithreads', order: 1 },
          { label: '💬 WhatsApp us', url: 'https://wa.me/8801700000000', order: 2 },
          { label: '📍 Visit our store', url: 'https://maps.google.com', order: 3 },
        ],
      },
    },
  });
  await prisma.qRCode.create({
    data: {
      tenantId: tenant.id, brandId: nokshi.id, label: 'Link-in-bio', targetUrl: `https://mkt-studio.example/l/${page.slug}`,
      fgColor: '#1D3557', bgColor: '#ffffff',
    },
  });

  // --- Video project ------------------------------------------------------
  await prisma.videoProject.create({
    data: {
      tenantId: tenant.id, brandId: nokshi.id, title: 'Eid Reel', aspect: '9:16', durationS: 10, status: 'DRAFT',
      images: [img('jamdani saree', 402), img('panjabi flatlay', 410), img('nakshi kantha', 411)],
      captions: ['This Eid,', 'wear heritage.', 'Nokshi Threads'],
    },
  });

  console.log('✅ Seed complete.');
  console.log('   Brands: Nokshi Threads, Cha Adda');
  console.log(`   Posts, briefs, assets, analytics & a published link-in-bio (/l/${page.slug}) created.`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
