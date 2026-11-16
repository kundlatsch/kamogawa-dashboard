from accounts.models import User

from .models import Notification


def notify_session_published(session) -> int:
    """Notify students about a published session; returns how many notifications were created.

    Sparring sessions alert every active student. Regular/extra sessions alert the
    students who have something to do in it (everyone, if it has a broadcast drill).
    Re-publishing never duplicates notifications.
    """
    from training.models import TrainingSession

    students = User.objects.filter(gym=session.gym, role=User.Role.STUDENT, is_active=True)
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


def notify_injury_reported(check_in) -> int:
    """Alert the gym's active coaches that a student reported pain or injury at check-in."""
    session = check_in.session
    coaches = User.objects.filter(gym=session.gym, role=User.Role.COACH, is_active=True)
    created = Notification.objects.bulk_create(
        [
            Notification(recipient=coach, kind=Notification.Kind.INJURY_REPORTED, session=session, subject=check_in.student)
            for coach in coaches
        ],
        ignore_conflicts=True,
    )
    return len(created)
