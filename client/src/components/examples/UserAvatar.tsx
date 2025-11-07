import UserAvatar from '../UserAvatar';

export default function UserAvatarExample() {
  return (
    <div className="flex gap-4 items-center p-4">
      <UserAvatar name="John Doe" size="sm" />
      <UserAvatar name="Anna Smith" size="md" />
      <UserAvatar name="Mike Johnson" size="lg" />
    </div>
  );
}
