import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { User } from './user.entity'

const ROLES = new Set(['admin', 'editor', 'viewer'])
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface UserDraft {
  name: string
  email: string
  role: string
}

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  async list(): Promise<User[]> {
    try {
      return await this.users.find({ order: { id: 'ASC' } })
    } catch (e) {
      throw new ServiceUnavailableException(this.dbMessage(e))
    }
  }

  async get(id: number): Promise<User> {
    try {
      const user = await this.users.findOneBy({ id })
      if (!user) throw new NotFoundException(`User ${id} not found`)
      return user
    } catch (e) {
      if (e instanceof NotFoundException) throw e
      throw new ServiceUnavailableException(this.dbMessage(e))
    }
  }

  async create(draft: UserDraft): Promise<User> {
    const user = this.users.create({ ...draft })
    try {
      return await this.users.save(user)
    } catch (e) {
      if (this.isUniqueViolation(e)) {
        throw new ConflictException('A user with this email already exists')
      }
      throw new ServiceUnavailableException(this.dbMessage(e))
    }
  }

  async update(id: number, draft: UserDraft): Promise<User> {
    let existing: User | null
    try {
      existing = await this.users.findOneBy({ id })
    } catch (e) {
      throw new ServiceUnavailableException(this.dbMessage(e))
    }
    if (!existing) throw new NotFoundException(`User ${id} not found`)

    this.users.merge(existing, draft)
    try {
      return await this.users.save(existing)
    } catch (e) {
      if (this.isUniqueViolation(e)) {
        throw new ConflictException('A user with this email already exists')
      }
      throw new ServiceUnavailableException(this.dbMessage(e))
    }
  }

  async remove(id: number): Promise<{ ok: true }> {
    try {
      const result = await this.users.delete(id)
      if (!result.affected) throw new NotFoundException(`User ${id} not found`)
      return { ok: true }
    } catch (e) {
      if (e instanceof NotFoundException) throw e
      throw new ServiceUnavailableException(this.dbMessage(e))
    }
  }

  validateDraft(raw: unknown): UserDraft {
    if (typeof raw !== 'object' || raw === null) {
      throw new BadRequestException('Request body must be a JSON object')
    }
    const body = raw as Record<string, unknown>

    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) throw new BadRequestException('name is required')
    if (name.length > 200) {
      throw new BadRequestException('name must be 200 characters or fewer')
    }

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    if (!email) throw new BadRequestException('email is required')
    if (email.length > 320 || !EMAIL_RE.test(email)) {
      throw new BadRequestException('email must be a valid address')
    }

    const role = typeof body.role === 'string' ? body.role : 'viewer'
    if (!ROLES.has(role)) {
      throw new BadRequestException(`role must be one of: ${[...ROLES].join(', ')}`)
    }

    return { name, email, role }
  }

  private dbMessage(e: unknown): string {
    return e instanceof Error && e.message ? e.message : 'Database unavailable'
  }

  private isUniqueViolation(e: unknown): boolean {
    const driver = (e as { driverError?: { code?: string } }).driverError
    return driver?.code === '23505' || (e as { code?: string }).code === '23505'
  }
}
