export type Role = 'super_admin' | 'staff' | 'teacher' | 'cashier' | 'student'

export interface User {
  id: string
  username: string
  email?: string
  fullName: string
  role: Role
  status: 'active' | 'deactivated'
  mustChangePassword: boolean
  schoolId: string
  studentRef?: string
}

export interface AuthResponse {
  accessToken: string
  user: User
}
