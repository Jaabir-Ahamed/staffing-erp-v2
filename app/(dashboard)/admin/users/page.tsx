import { InviteUserForm } from "@/src/features/auth/ui/invite-user-form";
import { RoleSelect } from "@/src/features/auth/ui/role-select";
import { listStaffUsers } from "@/src/features/auth/actions";
import { requireAdminUser } from "@/src/lib/auth";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";

export default async function AdminUsersPage() {
  const admin = await requireAdminUser();
  const users = await listStaffUsers();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="type-page">Staff accounts</h1>
        <p className="type-meta mt-1">
          Accounts are created here only. There is no public signup. Role is stored on
          public.users, which is what private.is_staff() and private.is_admin() read.
        </p>
      </div>
      <InviteUserForm />
      {users.error ? (
        <p className="type-body text-destructive">{users.error.message}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(users.data ?? []).map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.full_name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <RoleSelect userId={user.id} role={user.role} disabled={user.id === admin.id} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
