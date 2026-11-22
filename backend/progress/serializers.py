from rest_framework import serializers

from accounts.models import User
from training.models import Drill
from training.serializers import DrillSerializer, GymScopedSerializer, NamedListSerializer

from .models import Assessment, CoachNote, Homework, Metric, StudentPoint, week_start


class MetricSerializer(NamedListSerializer):
    class Meta:
        model = Metric
        fields = ["id", "name", "group", "color", "order", "archived"]


class AssessmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Assessment
        fields = ["id", "student", "metric", "period", "score", "notes", "updated_at"]


def month_start(day):
    return day.replace(day=1)


class SetAssessmentSerializer(serializers.Serializer):
    """Upsert one score; `score: null` clears it.

    `period` is optional: the coach keeps each student's current stats, so a score lands on the
    current month (older months stay as the student's history). Any day of a month selects it.
    """

    student = serializers.PrimaryKeyRelatedField(queryset=User.objects.none())
    metric = serializers.PrimaryKeyRelatedField(queryset=Metric.objects.none())
    period = serializers.DateField(required=False)
    score = serializers.IntegerField(min_value=0, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True, default="")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        gym = self.context["request"].user.gym
        self.fields["student"].queryset = User.objects.filter(gym=gym, role=User.Role.STUDENT)
        self.fields["metric"].queryset = Metric.objects.filter(gym=gym)

    def validate_period(self, value):
        return month_start(value)

    def validate_score(self, value):
        gym = self.context["request"].user.gym
        low, high = gym.assessment_scale_min, gym.assessment_scale_max
        if value is not None and not low <= value <= high:
            raise serializers.ValidationError(f"Scores go from {low} to {high}.")
        return value


class CoachNoteSerializer(GymScopedSerializer):
    gym_scoped_fields = {"student": lambda gym: User.objects.filter(gym=gym, role=User.Role.STUDENT)}
    student = serializers.PrimaryKeyRelatedField(queryset=User.objects.none())
    author_name = serializers.CharField(source="author.display_name", read_only=True, default="")

    class Meta:
        model = CoachNote
        fields = ["id", "student", "body", "visible_to_student", "author_name", "created_at"]

    def validate(self, attrs):
        if self.instance and "student" in attrs and attrs["student"] != self.instance.student:
            raise serializers.ValidationError({"student": "A note cannot move to another student."})
        return attrs


class StudentPointSerializer(GymScopedSerializer):
    gym_scoped_fields = {"student": lambda gym: User.objects.filter(gym=gym, role=User.Role.STUDENT)}
    student = serializers.PrimaryKeyRelatedField(queryset=User.objects.none())
    text = serializers.CharField(max_length=300, allow_blank=False, trim_whitespace=True)

    class Meta:
        model = StudentPoint
        fields = ["id", "student", "kind", "text", "created_at"]

    def validate(self, attrs):
        if self.instance and "student" in attrs and attrs["student"] != self.instance.student:
            raise serializers.ValidationError({"student": "A point cannot move to another student."})
        return attrs


class HomeworkSerializer(GymScopedSerializer):
    gym_scoped_fields = {
        "drill": lambda gym: Drill.objects.filter(gym=gym),
        "participants": lambda gym: User.objects.filter(gym=gym, role=User.Role.STUDENT, is_active=True),
    }
    participants = serializers.PrimaryKeyRelatedField(many=True, required=False, queryset=User.objects.none())
    drill_detail = DrillSerializer(source="drill", read_only=True)

    class Meta:
        model = Homework
        fields = [
            "id",
            "week_start",
            "title",
            "description",
            "drill",
            "drill_detail",
            "is_broadcast",
            "participants",
            "created_at",
        ]

    def validate_week_start(self, value):
        return week_start(value)

    def validate(self, attrs):
        is_broadcast = attrs.get("is_broadcast", getattr(self.instance, "is_broadcast", False))
        if "participants" in attrs:
            participants = attrs["participants"]
        elif self.instance:
            participants = list(self.instance.participants.all())
        else:
            participants = []
        if is_broadcast and participants:
            raise serializers.ValidationError("Homework for everyone cannot also list students.")
        if not is_broadcast and not participants:
            raise serializers.ValidationError("Pick at least one student or give it to everyone.")
        return attrs
