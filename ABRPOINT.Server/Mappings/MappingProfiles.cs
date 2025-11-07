using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Models;
using AutoMapper;

namespace ABRPOINT.Mappings
{
    public class MappingProfiles : Profile
    {
        public MappingProfiles()
        {
            CreateMap<Calendsoc, CalendsocDto>();
            CreateMap<Employe, EmployeDto>();
            CreateMap<Rubrique, RubriqueDto>();
            CreateMap<Avance, AvanceDto>()
                .ForMember(dest => dest.Emplib, opt => opt.MapFrom(src => src.Employe.Emplib));

            CreateMap<Presence, PresenceDto>();
            CreateMap<PresenceDto, Presence>();


            CreateMap<Poste, EmpHoraireDto>();
            CreateMap<PosteHoraireDto, Poste>();
            CreateMap<Poste, PosteHoraireDto>();
            CreateMap<UpdatePosteDto, Poste>();
            CreateMap<Poste, UpdatePosteDto>();

            CreateMap<Module, ModuleDto>();
            CreateMap<ModuleDto, Module>();

            CreateMap<Moduser, ModuserDto>();
            CreateMap<ModuserDto, Moduser>();

            CreateMap<Utilisateur, UtilisateurDto>();
            CreateMap<UtilisateurDto, Utilisateur>();

            CreateMap<Parametre, EtatPresenceParametreDto>();
            CreateMap<EtatPresenceParametreDto, Parametre>();
        }
    }
}
