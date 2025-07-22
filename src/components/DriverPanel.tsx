import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, CheckCircle, AlertTriangle, Package } from "lucide-react";

interface DeliveryTask {
  id: string;
  type: 'pickup' | 'delivery';
  customerName: string;
  address: string;
  time: string;
  service: string;
  status: 'pending' | 'completed' | 'problem';
  phoneNumber: string;
}

const mockTasks: DeliveryTask[] = [
  {
    id: '001',
    type: 'pickup',
    customerName: 'Matti Virtanen',
    address: 'Hämeenkatu 15, Tampere',
    time: '09:00-10:00',
    service: 'Normaali pesu',
    status: 'pending',
    phoneNumber: '+358 40 123 4567'
  },
  {
    id: '002',
    type: 'delivery',
    customerName: 'Anna Korhonen',
    address: 'Aleksanterinkatu 8, Tampere',
    time: '10:30-11:30',
    service: 'Urheiluvaatteet',
    status: 'completed',
    phoneNumber: '+358 50 987 6543'
  },
  {
    id: '003',
    type: 'pickup',
    customerName: 'Pekka Nieminen',
    address: 'Satakunnankatu 22, Tampere',
    time: '14:00-15:00',
    service: 'Premium-palvelu',
    status: 'pending',
    phoneNumber: '+358 45 555 1234'
  },
  {
    id: '004',
    type: 'delivery',
    customerName: 'Liisa Järvinen',
    address: 'Tuomiokirkonkatu 5, Tampere',
    time: '16:00-17:00',
    service: 'Pesu + mankelointi',
    status: 'problem',
    phoneNumber: '+358 44 777 8899'
  }
];

const getTaskTypeText = (type: string) => {
  return type === 'pickup' ? 'Nouto' : 'Toimitus';
};

const getTaskTypeIcon = (type: string) => {
  return type === 'pickup' ? Package : CheckCircle;
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending': return 'bg-blue-100 text-blue-800';
    case 'completed': return 'bg-green-100 text-green-800';
    case 'problem': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getStatusText = (status: string) => {
  switch (status) {
    case 'pending': return 'Odottaa';
    case 'completed': return 'Valmis';
    case 'problem': return 'Ongelma';
    default: return status;
  }
};

export const DriverPanel = () => {
  const [selectedTask, setSelectedTask] = useState<DeliveryTask | null>(null);

  const handleTaskAction = (taskId: string, action: 'complete' | 'problem') => {
    console.log(`Task ${taskId} marked as ${action}`);
    // Here would be the API call to update task status
  };

  const pendingTasks = mockTasks.filter(task => task.status === 'pending');
  const completedTasks = mockTasks.filter(task => task.status !== 'pending');

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8 animate-fade-in">
          <h1 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-hero bg-clip-text text-transparent">
            Kuljettajapaneeli
          </h1>
          <p className="text-lg text-muted-foreground mb-6">
            Tänään {pendingTasks.length} tehtävää odottaa suoritusta
          </p>
          
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-md mx-auto">
            <Card className="text-center">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-blue-600">{pendingTasks.length}</div>
                <div className="text-sm text-muted-foreground">Odottaa</div>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-600">{completedTasks.filter(t => t.status === 'completed').length}</div>
                <div className="text-sm text-muted-foreground">Valmis</div>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-red-600">{completedTasks.filter(t => t.status === 'problem').length}</div>
                <div className="text-sm text-muted-foreground">Ongelmia</div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Pending Tasks */}
        <div className="mb-8 animate-fade-in">
          <h2 className="text-2xl font-semibold mb-6">Odottavat tehtävät</h2>
          <div className="space-y-4">
            {pendingTasks.map((task) => {
              const TypeIcon = getTaskTypeIcon(task.type);
              return (
                <Card key={task.id} className="hover:shadow-elegant transition-all duration-300">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`flex items-center justify-center w-12 h-12 rounded-full ${
                          task.type === 'pickup' ? 'bg-blue-100' : 'bg-green-100'
                        }`}>
                          <TypeIcon className={`h-6 w-6 ${
                            task.type === 'pickup' ? 'text-blue-600' : 'text-green-600'
                          }`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold">{task.customerName}</h3>
                            <Badge variant="outline">
                              {getTaskTypeText(task.type)}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <MapPin className="h-4 w-4" />
                            {task.address}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            {task.time}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {task.service}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Button 
                          variant="default" 
                          size="sm"
                          onClick={() => handleTaskAction(task.id, 'complete')}
                          className="w-28"
                        >
                          {task.type === 'pickup' ? 'Noudettu' : 'Toimitettu'}
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleTaskAction(task.id, 'problem')}
                          className="w-28"
                        >
                          <AlertTriangle className="h-4 w-4 mr-1" />
                          Ongelma
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => window.open(`tel:${task.phoneNumber}`)}
                          className="w-28 text-xs"
                        >
                          Soita
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Completed Tasks */}
        {completedTasks.length > 0 && (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-semibold mb-6">Suoritetut tehtävät</h2>
            <div className="space-y-4">
              {completedTasks.map((task) => {
                const TypeIcon = getTaskTypeIcon(task.type);
                return (
                  <Card key={task.id} className="opacity-75">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gray-100">
                            <TypeIcon className="h-6 w-6 text-gray-600" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold">{task.customerName}</h3>
                              <Badge variant="outline">
                                {getTaskTypeText(task.type)}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <MapPin className="h-4 w-4" />
                              {task.address}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {task.service}
                            </div>
                          </div>
                        </div>
                        <Badge className={getStatusColor(task.status)}>
                          {getStatusText(task.status)}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};