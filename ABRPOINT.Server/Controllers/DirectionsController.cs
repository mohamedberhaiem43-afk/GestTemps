using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

// For more information on enabling Web API for empty projects, visit https://go.microsoft.com/fwlink/?LinkID=397860

namespace ABRPOINT.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class DirectionsController : ControllerBase
    {
        private readonly IDirectionRepository _directionRepository;
        public DirectionsController(IDirectionRepository directionRepository)
        {
            _directionRepository = directionRepository;
        }
        // GET: api/<DirectionsController>
        [HttpGet("get-directions/{soccod}")]
        public IEnumerable<Direction> Get(string soccod)
        {
            return _directionRepository.GetAll(soccod);
        }
        [HttpGet("get-dirlibs/{soccod}")]
        public Dictionary<string, string> GetSitLibs(string soccod)
        {
            return _directionRepository.GetDirLibs(soccod);
        }
        // GET api/<DirectionsController>/5
        [HttpGet("{id}")]
        public string Get(int id)
        {
            return "value";
        }

        // POST api/<DirectionsController>
        [HttpPost]
        public Direction Post([FromBody] Direction direction)
        {
            return _directionRepository.AddDirection(direction);
        }

        // PUT api/<DirectionsController>/5
        [HttpPut]
        public void Put(Direction direction)
        {
            if (direction != null)
                _directionRepository.Update(direction);
        }

        // DELETE api/<DirectionsController>/5
        [HttpDelete("{soccod}/{dircod}")]
        public void Delete(string soccod,string dircod)
        {
            Direction direction = _directionRepository.Get(soccod,dircod);
            if(direction != null)
                _directionRepository.Delete(direction);
        }
    }
}
