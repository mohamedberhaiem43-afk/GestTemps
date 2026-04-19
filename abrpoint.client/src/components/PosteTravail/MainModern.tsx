import PosteTravailModern from './PosteTravailModern'
import { PosteProvider } from '../helper/PostProvider/PostContext'
import { ClasseHoraireProvider } from '../helper/ClasseHoraireContext'

function MainModern() {
  return (
    <ClasseHoraireProvider>
      <PosteProvider>
        <PosteTravailModern />
      </PosteProvider>
    </ClasseHoraireProvider>
  )
}

export default MainModern