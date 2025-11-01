using ABRPOINT.Server.Models;
using Microsoft.AspNetCore.Mvc;

namespace ABRPOINT.Server.Interfaces
{
    public interface IDirectionRepository : IRepository<Direction>
    {
        public Dictionary<string, string> GetDirLibs(string soccod);
        public Direction AddDirection(Direction direction);
        Direction Get(string soccod, string dircod);
        public IEnumerable<Direction> GetAll(string soccod);
    }
}
