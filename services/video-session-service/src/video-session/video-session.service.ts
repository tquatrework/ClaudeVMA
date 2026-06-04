import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { VideoRoom, RoomStatus } from './entities/video-room.entity';
import { CreateRoomDto } from './dto/create-room.dto';

@Injectable()
export class VideoSessionService {
  constructor(
    @InjectRepository(VideoRoom) private readonly repo: Repository<VideoRoom>,
  ) {}

  create(dto: CreateRoomDto) {
    const room = this.repo.create({ ...dto, roomToken: uuidv4() });
    return this.repo.save(room);
  }

  async findOne(id: string) {
    const room = await this.repo.findOne({ where: { id } });
    if (!room) throw new NotFoundException(`Room ${id} not found`);
    return room;
  }

  async join(id: string) {
    const room = await this.findOne(id);
    if (room.status === RoomStatus.WAITING) {
      room.status = RoomStatus.ACTIVE;
      room.startedAt = new Date();
      await this.repo.save(room);
    }
    return { roomToken: room.roomToken, status: room.status };
  }

  async end(id: string) {
    const room = await this.findOne(id);
    room.status = RoomStatus.ENDED;
    room.endedAt = new Date();
    return this.repo.save(room);
  }
}
