import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserProfile } from './entities/user-profile.entity';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UserProfileService {
  constructor(
    @InjectRepository(UserProfile) private readonly repo: Repository<UserProfile>,
  ) {}

  create(dto: CreateProfileDto) {
    return this.repo.save(this.repo.create(dto));
  }

  findAll() {
    return this.repo.find();
  }

  async findByUserId(userId: string) {
    const profile = await this.repo.findOne({ where: { userId } });
    if (!profile) throw new NotFoundException(`Profile for user ${userId} not found`);
    return profile;
  }

  async update(userId: string, dto: UpdateProfileDto) {
    const profile = await this.findByUserId(userId);
    return this.repo.save({ ...profile, ...dto });
  }

  async remove(userId: string) {
    const profile = await this.findByUserId(userId);
    await this.repo.remove(profile);
    return { deleted: true };
  }
}
