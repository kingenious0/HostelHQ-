import { Header } from '@/components/header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { DollarSign, BarChart, Users, CheckCircle, XCircle } from 'lucide-react';
import { adminStats, pendingHostels } from '@/lib/data';

export default function AdminDashboard() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 bg-gray-50/50 p-4 md:p-8">
        <div className="container mx-auto">
          <h1 className="text-3xl font-bold font-headline mb-6">Admin Dashboard</h1>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{adminStats.revenue}</div>
                <p className="text-xs text-muted-foreground">+20.1% from last month</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Occupancy Rate</CardTitle>
                <BarChart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{adminStats.occupancyRate}</div>
                <p className="text-xs text-muted-foreground">+2% from last month</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Top Performing Agents</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {adminStats.topAgents.map(agent => (
                    <div key={agent.name} className="flex justify-between text-sm">
                      <span>{agent.name}</span>
                      <span className="font-semibold">{agent.sales} bookings</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Pending Hostel Approvals</CardTitle>
              <CardDescription>Review and approve or reject new hostel listings.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hostel Name</TableHead>
                    <TableHead className="hidden md:table-cell">Agent</TableHead>
                    <TableHead className="hidden lg:table-cell">Location</TableHead>
                    <TableHead className="hidden md:table-cell">Date Submitted</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingHostels.map(hostel => (
                    <TableRow key={hostel.id}>
                      <TableCell className="font-medium">{hostel.name}</TableCell>
                      <TableCell className="hidden md:table-cell">{hostel.agent}</TableCell>
                      <TableCell className="hidden lg:table-cell">{hostel.location}</TableCell>
                      <TableCell className="hidden md:table-cell">{hostel.dateSubmitted}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="ghost" size="icon" className="text-primary hover:text-primary/80">
                           <span className="sr-only">Approve</span>
                           <CheckCircle className="h-5 w-5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/80">
                           <span className="sr-only">Reject</span>
                           <XCircle className="h-5 w-5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
