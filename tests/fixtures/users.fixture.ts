export const attendeeFixture = {
  email: 'attendee@test.com',
  password: 'Test@1234!',
  firstName: 'John',
  lastName: 'Doe',
  role: 'ATTENDEE' as const,
  company: 'Test Startup',
};

export const organizerFixture = {
  email: 'organizer@test.com',
  password: 'Test@1234!',
  firstName: 'Jane',
  lastName: 'Smith',
  role: 'ORGANIZER' as const,
  company: 'Event Co',
};

export const adminFixture = {
  email: 'admin@test.com',
  password: 'Test@1234!',
  firstName: 'Admin',
  lastName: 'User',
  role: 'ADMIN' as const,
  company: 'Golden Tap Connect',
};

export const invalidUserFixtures = {
  missingEmail: {
    password: 'Test@1234!',
    firstName: 'John',
    lastName: 'Doe',
    role: 'ATTENDEE',
  },
  invalidEmail: {
    email: 'not-an-email',
    password: 'Test@1234!',
    firstName: 'John',
    lastName: 'Doe',
    role: 'ATTENDEE',
  },
  weakPassword: {
    email: 'test@test.com',
    password: 'weak',
    firstName: 'John',
    lastName: 'Doe',
    role: 'ATTENDEE',
  },
  shortFirstName: {
    email: 'test@test.com',
    password: 'Test@1234!',
    firstName: 'J',
    lastName: 'Doe',
    role: 'ATTENDEE',
  },
};

export const eventFixture = {
  title: 'Test Startup Conference 2024',
  description: 'A conference for startup founders and investors to connect and share ideas.',
  startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
  endDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
  location: {
    address: '123 Innovation St',
    city: 'San Francisco',
    country: 'USA',
  },
  capacity: 100,
  type: 'IN_PERSON' as const,
  tags: ['startup', 'networking', 'technology'],
};
