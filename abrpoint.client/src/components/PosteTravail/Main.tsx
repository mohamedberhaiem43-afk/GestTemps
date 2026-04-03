import PosteDeTravail from './PosteTravail'
import { PosteProvider } from '../helper/PostProvider/PostContext'
import { ClasseHoraireProvider } from '../helper/ClasseHoraireContext'

function Main() {
     
  return (
    <ClasseHoraireProvider>
    <PosteProvider>
        <PosteDeTravail />
    </PosteProvider>
    </ClasseHoraireProvider>
  )
}

export default Main