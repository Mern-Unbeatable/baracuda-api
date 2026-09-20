import prisma from '../../config/prisma.js';
import { PaginationUtil } from '../../utils/pagination.js';

export class DemoProfileService {
  /**
   * Create a new demo profile
   */
  async createProfile(data, adminId) {
    const { bio, ...rest } = data;
    
    // Check username and email exist in DemoProfile or User table
    const [existingDemoUsername, existingUserUsername, existingDemoEmail, existingUserEmail] = await Promise.all([
      prisma.demoProfile.findUnique({ where: { username: rest.username } }),
      prisma.user.findUnique({ where: { username: rest.username } }),
      prisma.demoProfile.findFirst({ where: { email: rest.email } }),
      prisma.user.findUnique({ where: { email: rest.email } })
    ]);
    
    if (existingDemoUsername || existingUserUsername) {
      throw new Error('Username already exists');
    }
    
    if (existingDemoEmail || existingUserEmail) {
      throw new Error('Email is already registered');
    }

    const newProfile = await prisma.demoProfile.create({
      data: {
        ...rest,
        bio: bio ? { en: bio } : {}, // Storing as Json
        socialLinks: rest.socialLinks || [],
        createdById: adminId
      }
    });
    
    return newProfile;
  }

  /**
   * Get stats for Demo Profiles
   */
  async getStats() {
    const total = await prisma.demoProfile.count();
    const active = await prisma.demoProfile.count({ where: { isActive: true } });
    
    return {
      totalProfiles: total,
      activeProfiles: active,
      inactiveProfiles: total - active
    };
  }

  /**
   * Get paginated demo profiles with optional status filter
   */
  async getProfiles(isActive, page = 1, limit = 10) {
    const where = {};
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const skip = (page - 1) * limit;

    const [profiles, total] = await Promise.all([
      prisma.demoProfile.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          fullName: true,
          username: true,
          phone: true,
          email: true,
          isActive: true
        }
      }),
      prisma.demoProfile.count({ where })
    ]);

    // Format for UI
    const formattedData = profiles.map(profile => ({
      profile: profile.fullName,
      username: `@${profile.username}`,
      phoneNumber: profile.phone,
      email: profile.email,
      status: profile.isActive ? 'Active' : 'Inactive',
      id: profile.id
    }));

    return {
      data: formattedData,
      meta: PaginationUtil.getMetadata(total, page, limit)
    };
  }

  /**
   * Toggle profile active/inactive status
   */
  async updateStatus(id, isActive) {
    const updated = await prisma.demoProfile.update({
      where: { id },
      data: { isActive }
    });
    return updated;
  }

  /**
   * Get single profile details
   */
  async getProfileDetails(id) {
    const profile = await prisma.demoProfile.findUnique({
      where: { id }
    });

    if (!profile) {
      throw new Error('Demo profile not found');
    }

    const bioObj = profile.bio || {};
    const bioText = bioObj.en || bioObj[Object.keys(bioObj)[0]] || '';

    return {
      id: profile.id,
      name: profile.fullName,
      username: `@${profile.username}`,
      status: profile.isActive ? 'Active' : 'Inactive',
      contactInformation: {
        phoneNumber: profile.phone,
        email: profile.email
      },
      about: bioText,
      socialMedia: profile.socialLinks,
      profilePhoto: profile.profilePhoto,
      coverPhoto: profile.coverPhoto
    };
  }
}
