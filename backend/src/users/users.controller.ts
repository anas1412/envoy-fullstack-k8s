import { Body, Controller, Delete, Get, NotFoundException, Param, Post, Put } from '@nestjs/common'
import { User } from './user.entity'
import { UsersService } from './users.service'

function parseId(raw: string): number | null {
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? n : null
}

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(): Promise<User[]> {
    return this.users.list()
  }

  @Get(':id')
  get(@Param('id') idRaw: string): Promise<User> {
    const id = parseId(idRaw)
    if (id === null) throw new NotFoundException(`No route for GET /api/users/${idRaw}`)
    return this.users.get(id)
  }

  @Post()
  create(@Body() raw: unknown): Promise<User> {
    return this.users.create(this.users.validateDraft(raw))
  }

  @Put(':id')
  update(@Param('id') idRaw: string, @Body() raw: unknown): Promise<User> {
    const id = parseId(idRaw)
    if (id === null) throw new NotFoundException(`No route for PUT /api/users/${idRaw}`)
    return this.users.update(id, this.users.validateDraft(raw))
  }

  @Delete(':id')
  remove(@Param('id') idRaw: string): Promise<{ ok: true }> {
    const id = parseId(idRaw)
    if (id === null) throw new NotFoundException(`No route for DELETE /api/users/${idRaw}`)
    return this.users.remove(id)
  }
}
