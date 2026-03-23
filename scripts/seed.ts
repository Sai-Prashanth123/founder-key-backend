import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const BADGE_DEFINITIONS = [
  {
    name: 'First Connection',
    description: 'Made your first connection on the platform',
    icon: 'handshake',
    condition: { type: 'connection_count', threshold: 1 },
    points: 25,
  },
  {
    name: 'Network Starter',
    description: 'Connected with 10 or more people',
    icon: 'network',
    condition: { type: 'connection_count', threshold: 10 },
    points: 50,
  },
  {
    name: 'Super Connector',
    description: 'Built an impressive network of 50+ connections',
    icon: 'star-network',
    condition: { type: 'connection_count', threshold: 50 },
    points: 100,
  },
  {
    name: 'Event Goer',
    description: 'Registered for your first event',
    icon: 'calendar',
    condition: { type: 'event_count', threshold: 1 },
    points: 25,
  },
  {
    name: 'Event Enthusiast',
    description: 'Participated in 5 or more events',
    icon: 'calendar-star',
    condition: { type: 'event_count', threshold: 5 },
    points: 75,
  },
  {
    name: 'Founder',
    description: 'Earned the prestigious Founder Card',
    icon: 'crown',
    condition: { type: 'founder_card_active', threshold: 1 },
    points: 150,
  },
  {
    name: 'Profile Champion',
    description: 'Completed 100% of your profile',
    icon: 'user-check',
    condition: { type: 'profile_complete', threshold: 100 },
    points: 50,
  },
  {
    name: 'QR Master',
    description: 'Scanned 10 QR codes to connect with founders',
    icon: 'qr-code',
    condition: { type: 'qr_scan_count', threshold: 10 },
    points: 75,
  },
  {
    name: 'Early Adopter',
    description: 'One of the first 100 members to join the platform',
    icon: 'rocket',
    condition: { type: 'early_adopter', threshold: 100 },
    points: 200,
  },
  {
    name: 'Community Pillar',
    description: 'Accumulated 500 or more FK Score points',
    icon: 'pillar',
    condition: { type: 'score_threshold', threshold: 500 },
    points: 100,
  },
];

const PLATFORM_SETTINGS = [
  { key: 'app_name', value: 'Golden Tap Connect', type: 'string', label: 'Application Name' },
  { key: 'app_description', value: 'The premier networking platform for founders', type: 'string', label: 'App Description' },
  { key: 'max_connections_per_day', value: '50', type: 'number', label: 'Max Connections Per Day' },
  { key: 'founder_card_auto_approve', value: 'false', type: 'boolean', label: 'Auto-approve Founder Cards' },
  { key: 'event_max_capacity', value: '10000', type: 'number', label: 'Event Maximum Capacity' },
  { key: 'maintenance_mode', value: 'false', type: 'boolean', label: 'Maintenance Mode' },
  { key: 'allow_public_profiles', value: 'true', type: 'boolean', label: 'Allow Public Profiles' },
  { key: 'min_password_length', value: '8', type: 'number', label: 'Minimum Password Length' },
  { key: 'max_upload_size_mb', value: '5', type: 'number', label: 'Max Upload Size (MB)' },
  { key: 'featured_events_limit', value: '6', type: 'number', label: 'Featured Events on Homepage' },
];

async function seedBadges() {
  console.log('Seeding badges...');
  let created = 0;

  for (const badge of BADGE_DEFINITIONS) {
    await prisma.badge.upsert({
      where: { name: badge.name },
      update: {
        description: badge.description,
        icon: badge.icon,
        condition: badge.condition,
        points: badge.points,
      },
      create: badge,
    });
    created++;
  }

  console.log(`  ✓ ${created} badges seeded`);
}

async function seedPlatformSettings() {
  console.log('Seeding platform settings...');
  let created = 0;

  for (const setting of PLATFORM_SETTINGS) {
    await prisma.platformSetting.upsert({
      where: { key: setting.key },
      update: { value: setting.value, type: setting.type, label: setting.label },
      create: setting,
    });
    created++;
  }

  console.log(`  ✓ ${created} platform settings seeded`);
}

async function seedAdminUser() {
  console.log('Seeding admin user...');

  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@goldentap.com';
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'Admin@GoldenTap2024!';

  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (existing) {
    console.log(`  ✓ Admin user already exists: ${adminEmail}`);
    return existing;
  }

  const hashedPassword = await bcrypt.hash(adminPassword, 12);

  const admin = await prisma.user.create({
    data: {
      email: adminEmail,
      password: hashedPassword,
      role: 'ADMIN',
      tier: 'FOUNDER',
      isActive: true,
      isEmailVerified: true,
      profile: {
        create: {
          firstName: 'Platform',
          lastName: 'Admin',
          company: 'Golden Tap Connect',
          position: 'Platform Administrator',
        },
      },
      gamification: {
        create: {
          fkScore: 1000,
          level: 6,
        },
      },
    },
  });

  console.log(`  ✓ Admin user created: ${adminEmail}`);
  return admin;
}

async function seedSampleOrganizer() {
  console.log('Seeding sample organizer...');

  const email = 'organizer@goldentap.com';
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`  ✓ Sample organizer already exists: ${email}`);
    return existing;
  }

  const hashedPassword = await bcrypt.hash('Organizer@1234!', 12);

  const organizer = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      role: 'ORGANIZER',
      tier: 'FOUNDER',
      isActive: true,
      isEmailVerified: true,
      profile: {
        create: {
          firstName: 'Sarah',
          lastName: 'Johnson',
          company: 'Startup Events Co',
          position: 'Event Director',
          bio: 'Organizing world-class startup events since 2020',
          location: 'San Francisco, CA',
          skills: ['Event Planning', 'Networking', 'Startup Ecosystem'],
          linkedin: 'https://linkedin.com/in/sarahjohnson',
        },
      },
      gamification: {
        create: {
          fkScore: 500,
          level: 5,
        },
      },
    },
  });

  console.log(`  ✓ Sample organizer created: ${email}`);
  return organizer;
}

async function seedSampleAttendees() {
  console.log('Seeding sample attendees...');

  const attendees = [
    {
      email: 'alice@startup.com',
      firstName: 'Alice',
      lastName: 'Chen',
      company: 'TechVentures Inc',
      position: 'CTO',
      bio: 'Building the future of AI-powered applications',
      skills: ['AI/ML', 'Python', 'Cloud Architecture'],
    },
    {
      email: 'bob@innovation.com',
      firstName: 'Bob',
      lastName: 'Martinez',
      company: 'Innovation Labs',
      position: 'Founder & CEO',
      bio: 'Serial entrepreneur with 3 successful exits',
      skills: ['Leadership', 'Product Strategy', 'Fundraising'],
    },
    {
      email: 'carol@design.io',
      firstName: 'Carol',
      lastName: 'Williams',
      company: 'Design.io',
      position: 'Head of Product Design',
      bio: 'Designing products that users love',
      skills: ['UX Design', 'Product Management', 'Figma'],
    },
  ];

  let created = 0;

  for (const attendee of attendees) {
    const existing = await prisma.user.findUnique({ where: { email: attendee.email } });
    if (existing) continue;

    const hashedPassword = await bcrypt.hash('Attendee@1234!', 12);

    await prisma.user.create({
      data: {
        email: attendee.email,
        password: hashedPassword,
        role: 'ATTENDEE',
        tier: 'FREE',
        isActive: true,
        isEmailVerified: true,
        profile: {
          create: {
            firstName: attendee.firstName,
            lastName: attendee.lastName,
            company: attendee.company,
            position: attendee.position,
            bio: attendee.bio,
            skills: attendee.skills,
            location: 'San Francisco, CA',
          },
        },
        gamification: {
          create: {
            fkScore: Math.floor(Math.random() * 200),
            level: Math.floor(Math.random() * 3) + 1,
          },
        },
      },
    });
    created++;
  }

  console.log(`  ✓ ${created} sample attendees created`);
}

async function seedSampleEvents(organizerId: string) {
  console.log('Seeding sample events...');

  const events = [
    {
      title: 'Founder Summit 2024',
      description: 'The premiere gathering of founders and investors in the Bay Area. Join us for a day of insights, networking, and deal-making. Featuring keynotes from successful exits and leading VCs.',
      startDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 2 weeks
      endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000),
      locationType: 'IN_PERSON' as const,
      address: '747 Howard St',
      city: 'San Francisco',
      country: 'USA',
      capacity: 300,
      tags: ['startup', 'founders', 'investment', 'networking'],
      status: 'PUBLISHED' as const,
    },
    {
      title: 'AI & Machine Learning Workshop',
      description: 'Deep dive into practical AI/ML implementation for startup products. Hands-on workshop with industry experts covering LLMs, computer vision, and production deployment.',
      startDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000), // 3 weeks
      endDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000 + 6 * 60 * 60 * 1000),
      locationType: 'HYBRID' as const,
      meetingUrl: 'https://meet.google.com/abc-defg-hij',
      address: '500 Mission St',
      city: 'San Francisco',
      country: 'USA',
      capacity: 150,
      tags: ['AI', 'machine learning', 'workshop', 'technology'],
      status: 'PUBLISHED' as const,
    },
    {
      title: 'Virtual Pitch Night',
      description: 'Monthly virtual pitch event where startups present to angel investors and early-stage VCs. Apply to pitch or join as an investor.',
      startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 1 month
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
      locationType: 'VIRTUAL' as const,
      meetingUrl: 'https://zoom.us/j/123456789',
      capacity: 100,
      tags: ['pitch', 'investment', 'virtual', 'startups'],
      status: 'PUBLISHED' as const,
    },
  ];

  let created = 0;

  for (const event of events) {
    const existing = await prisma.event.findFirst({
      where: { title: event.title, organizerId },
    });
    if (existing) continue;

    await prisma.event.create({
      data: {
        ...event,
        organizerId,
      },
    });
    created++;
  }

  console.log(`  ✓ ${created} sample events created`);
}

async function main() {
  console.log('Starting database seed...\n');

  try {
    await seedBadges();
    await seedPlatformSettings();

    const admin = await seedAdminUser();
    const organizer = await seedSampleOrganizer();
    await seedSampleAttendees();
    await seedSampleEvents(organizer.id);

    console.log('\nDatabase seed completed successfully!');
    console.log('\nDefault Credentials:');
    console.log('─────────────────────────────────────');
    console.log(`Admin:     ${process.env.ADMIN_EMAIL ?? 'admin@goldentap.com'} / Admin@GoldenTap2024!`);
    console.log(`Organizer: organizer@goldentap.com / Organizer@1234!`);
    console.log(`Attendee:  alice@startup.com / Attendee@1234!`);
    console.log('─────────────────────────────────────');

    void admin;
  } catch (error) {
    console.error('Seed failed:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
