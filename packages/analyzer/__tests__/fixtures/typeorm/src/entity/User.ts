import {
  Column,
  Entity,
  ManyToMany,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm'

@Entity('users')
export class User {
  @Column()
  @PrimaryGeneratedColumn()
  id!: number

  @Column()
  name!: string

  @Column()
  nickname?: string

  @OneToOne(() => Profile)
  profile!: Profile

  @OneToMany(() => Post, post => post.author)
  posts!: Post[]

  @ManyToOne(() => Team)
  team!: Promise<Team>

  @ManyToMany(Role)
  roles!: Role[]
}

class Profile {}
class Post { author!: User }
class Team {}
class Role {}
