"use client";

import { useState } from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SearchIcon, DownloadIcon, TrashIcon, EditIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

// Mock Data
const MOCK_PROJECTS = [
  { id: "1", title: "Welcome Email for SaaS", type: "Email", date: "2024-05-12", status: "Completed" },
  { id: "2", title: "Q3 Marketing Strategy", type: "Blog", date: "2024-05-10", status: "Draft" },
  { id: "3", title: "Twitter Launch Thread", type: "Social", date: "2024-05-08", status: "Completed" },
  { id: "4", title: "Facebook Ad Copy", type: "Ad", date: "2024-05-01", status: "Completed" },
];

export default function ProjectsPage() {
  const [search, setSearch] = useState("");
  
  const filteredProjects = MOCK_PROJECTS.filter(p => 
    p.title.toLowerCase().includes(search.toLowerCase()) || 
    p.type.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Projects</h1>
          <p className="text-zinc-500 mt-2">Manage and view your generated AI content.</p>
        </div>
        <Link href="/en/dashboard/generate">
          <Button className="bg-[#F25C38] hover:bg-[#D94C2B] text-white">
            <PlusIcon size={16} className="mr-2" /> New Project
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader className="pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Recent Content</CardTitle>
            <div className="relative w-64">
              <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <Input 
                placeholder="Search projects..." 
                className="pl-9 bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-zinc-50/50 dark:bg-zinc-900/50">
              <TableRow>
                <TableHead className="pl-6">Project Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date Created</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProjects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-zinc-500">
                    No projects found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredProjects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell className="pl-6 font-medium text-zinc-900 dark:text-zinc-100">
                      {project.title}
                    </TableCell>
                    <TableCell>
                      <span className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-md text-xs font-medium">
                        {project.type}
                      </span>
                    </TableCell>
                    <TableCell className="text-zinc-500">
                      {new Date(project.date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                        project.status === "Completed" 
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                      }`}>
                        {project.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right pr-6 space-x-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <EditIcon size={14} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <DownloadIcon size={14} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950">
                        <TrashIcon size={14} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
