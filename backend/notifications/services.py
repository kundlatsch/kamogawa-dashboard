from accounts.models import User

from .models import Notification


def notify_session_published(session) -> int:
    """Notify students about a published session; returns how many notifications were created.

    Sparring sessions alert every active student. Regular/extra sessions alert the
    students who have something to do in it (everyone, if it has a broadcast drill).
    Re-publishing never duplicates notifications.
    """
    from training.models import TrainingSession

    students = User.objects.filter(role=User.Role.STUDENT, is_active=True)
    if session.kind == TrainingSession.Kind.SPARRING:
        kind = Notification.Kind.SPARRING
    else:
        kind = Notification.Kind.SESSION_PUBLISHED
        if not session.assignments.filter(is_broadcast=True).exists():
            students = students.filter(training_assignments__session=session).distinct()

    created = Notification.objects.bulk_create(
        [Notification(recipient=student, kind=kind, session=session) for student in students],
        ignore_conflicts=True,
    )
    return len(created)
