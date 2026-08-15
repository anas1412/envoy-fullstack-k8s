import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ type: 'text' })
  name: string

  @Column({ type: 'text' })
  email: string

  @Column({ type: 'text', default: 'viewer' })
  role: string

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  created_at: string
}
