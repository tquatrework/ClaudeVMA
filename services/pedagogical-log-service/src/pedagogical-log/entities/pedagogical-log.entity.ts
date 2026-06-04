import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('pedagogical_logs')
export class PedagogicalLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'session_id' })
  sessionId: string;

  @Column({ name: 'student_id' })
  studentId: string;

  @Column({ name: 'teacher_id' })
  teacherId: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'skills_worked', type: 'simple-array', nullable: true })
  skillsWorked: string[];

  @Column({ nullable: true })
  difficulty: string;

  @Column({ nullable: true })
  rating: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
