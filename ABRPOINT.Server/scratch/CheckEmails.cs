using System;
using System.Linq;
using Microsoft.EntityFrameworkCore;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Models;
using Microsoft.Extensions.DependencyInjection;

namespace ABRPOINT.Server.Scratch
{
    public class CheckEmails
    {
        public static void Run(IServiceProvider serviceProvider)
        {
            using var scope = serviceProvider.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            
            Console.WriteLine("--- Checking Admin Emails ---");
            var admins = context.Utilisateurs.Where(u => u.Utiadm == "1").ToList();
            foreach (var admin in admins)
            {
                Console.WriteLine($"Admin: {admin.Uticod}, Name: {admin.Utinom}, Email: '{admin.Utimail}'");
            }
            
            Console.WriteLine("\n--- Checking Recent Leave Requests ---");
            var recentRequests = context.Demconges.OrderByDescending(d => d.Condat).Take(5).ToList();
            foreach (var req in recentRequests)
            {
                var emp = context.Utilisateurs.FirstOrDefault(u => u.Uticod == req.Empcod);
                Console.WriteLine($"Req: {req.Concod}, Emp: {req.Empcod}, EmpEmail: '{emp?.Utimail}'");
            }
        }
    }
}
