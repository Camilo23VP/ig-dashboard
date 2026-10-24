import { fmt } from "../api";

export default function ProfileHeader({ profile }) {
  return (
    <header className="profile">
      {profile.profile_picture_url && <img className="avatar" src={profile.profile_picture_url} alt="" />}
      <div>
        <h1>@{profile.username}</h1>
        {profile.name && <p className="muted">{profile.name}</p>}
        <div className="profile-stats">
          <span><b>{fmt(profile.media_count)}</b> publicaciones</span>
          <span><b>{fmt(profile.followers_count)}</b> seguidores</span>
          <span><b>{fmt(profile.follows_count)}</b> seguidos</span>
        </div>
      </div>
    </header>
  );
}
